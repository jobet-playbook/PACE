import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createJiraClient } from '@/lib/jira-client'
import { JiraWorkflowProcessor } from '@/lib/jira-workflow'
import { cachePool, CacheKeys } from '@/lib/cache-pool'
import { readFromNormalizedTables, writeToNormalizedTables, getLastBusinessDay } from '@/lib/qa-metrics-db'

/**
 * GET /api/qa-metrics/live
 *
 * Read priority (fastest → slowest, stops at first hit):
 *  1. In-memory cache          (5-min TTL, instant)
 *  2. Normalized pace_qa_* tables (< 23 h old, written by sync cron)
 *  3. Live Jira API            (fallback – writes to normalized tables + warms cache)
 */
export async function GET(_request: NextRequest) {
  const cacheKey = CacheKeys.LIVE_METRICS

  try {
    // ── 1. Memory cache ───────────────────────────────────────────────────
    const cached = await cachePool.get(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, _cached: true, _source: 'memory_cache' })
    }

    // ── 2. Normalized Supabase tables ─────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const fromDb = await readFromNormalizedTables(supabase)
      if (fromDb) {
        await cachePool.set(cacheKey, fromDb)
        return NextResponse.json({ ...fromDb, _cached: true, _source: 'normalized_tables' })
      }
    }

    // ── 3. Live Jira API ──────────────────────────────────────────────────
    console.log('📊 [Live] No recent DB data — fetching from Jira...')

    const jiraBaseUrl = process.env.JIRA_BASE_URL
    const jiraEmail   = process.env.JIRA_EMAIL
    const jiraToken   = process.env.JIRA_API_TOKEN

    if (!jiraBaseUrl || !jiraEmail || !jiraToken || jiraToken.includes('BLANK_VALUE')) {
      return NextResponse.json(
        {
          error: 'Jira credentials not configured',
          message: 'Add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to .env.local',
          instructions: 'Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens',
        },
        { status: 500 }
      )
    }

    const jiraClient = createJiraClient()
    const processor  = new JiraWorkflowProcessor(jiraClient)

    console.log('📊 [Live] Processing rollback windows...')
    const rollback_windows = await processor.processAllWindows()

    // Deduplicate WIP tickets
    const seenCritical = new Set<string>()
    const seenOld      = new Set<string>()
    const critical_qa_wip_tickets: any[] = []
    const old_qa_wip_tickets: any[]      = []

    for (const data of Object.values(rollback_windows)) {
      if (!data?.qa_in_progress) continue

      for (const ticket of data.qa_in_progress.critical_qa_wip_tickets ?? []) {
        if (ticket?.ticket_key && !seenCritical.has(ticket.ticket_key)) {
          seenCritical.add(ticket.ticket_key)
          critical_qa_wip_tickets.push(ticket)
        }
      }

      for (const ticket of data.qa_in_progress.old_qa_wip_tickets ?? []) {
        if (ticket?.ticket_key && !seenOld.has(ticket.ticket_key)) {
          seenOld.add(ticket.ticket_key)
          old_qa_wip_tickets.push(ticket)
        }
      }
    }

    // Build last_30_business_days with actual first/repeat breakdown
    const w28Throughput = rollback_windows.w28?.throughput
    const w28Tickets: any[] = (w28Throughput?.per_qa_member_throughput ?? []).flatMap(
      (m: any) => m.tickets ?? []
    )
    const firstPassCount = w28Tickets.filter((t: any) => !t.had_previous_returns).length
    const repeatCount    = w28Tickets.filter((t: any) => t.had_previous_returns).length
    const firstPassSP    = w28Tickets.filter((t: any) => !t.had_previous_returns).reduce((s: number, t: any) => s + (t.story_points ?? 0), 0)
    const repeatSP       = w28Tickets.filter((t: any) => t.had_previous_returns).reduce((s: number, t: any) => s + (t.story_points ?? 0), 0)

    const last_30_business_days = {
      total_tickets: w28Throughput?.total_tickets ?? 0,
      story_points:  w28Throughput?.total_story_points ?? 0,
      first_qa_cycle: { ticket_count: firstPassCount, story_points: firstPassSP },
      returning_qa_cycle: { ticket_count: repeatCount, story_points: repeatSP },
      qa_handlers: (w28Throughput?.per_qa_member_throughput ?? []).map((m: any) => ({
        qa_assignee: m.qa_name,
        handled_ticket_count: m.unique_ticket_count,
        handled_ticket_story_points: m.unique_ticket_story_points,
      })),
    }

    const response = {
      output: {
        report_meta: {
          generated_at_et: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
          report_type: 'Daily QA Performance Report',
          today_label: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
        },
        people: buildPeopleData(rollback_windows.w1, rollback_windows.prior_w1),
      },
      rollback_windows,
      last_30_business_days,
      critical_qa_wip_tickets,
      old_qa_wip_tickets,
    }

    // Persist to normalized tables so future requests skip Jira
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      writeToNormalizedTables(supabase, response).catch(err =>
        console.error('⚠️ [Live] Failed to write normalized tables:', err)
      )
    }

    // Warm memory cache
    await cachePool.set(cacheKey, response)

    return NextResponse.json({ ...response, _cached: false, _source: 'jira_api' })

  } catch (error) {
    console.error('❌ [Live] Error:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'
    const isRateLimit = message.includes('429') || message.toLowerCase().includes('rate limit')

    if (isRateLimit) {
      const stale = await cachePool.getStale(cacheKey)
      if (stale) {
        return NextResponse.json({ ...stale, _cached: true, _stale: true, _rateLimited: true, _source: 'stale_cache' })
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch QA metrics', details: message },
      { status: 500 }
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPeopleData(w1Data: any, priorW1Data: any) {
  const qaMembers = new Map<string, any>()

  const mapTicket = (ticket: any) => {
    const completionTime = ticket.history_created
      ? new Date(ticket.history_created).toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
        }) + ' ET'
      : ''
    return {
      ticket_id: ticket.ticket_key,
      completed_time_et: completionTime,
      story_points: ticket.story_points,
      handled_stage: ticket.handled_stage,
      new_stage: 'Done',
      pass_type: ticket.had_previous_returns ? 'repeat_pass' : 'first_time_pass',
      qa_return_cycles_count: ticket.qa_return_cycles_count ?? 0,
      had_previous_returns: ticket.had_previous_returns ?? false,
      recap: `${ticket.ticket_key} completed QA (${ticket.story_points ?? 0} pt${ticket.story_points === 1 ? '' : 's'}, ${ticket.had_previous_returns ? 'repeat' : 'first-time'} pass) moving from ${ticket.handled_stage} to Done.`,
    }
  }

  const buildStats = (members: any[], targetName: string) => {
    const member = members.find((m: any) => m.qa_name === targetName)
    if (!member) return { ticket_count: 0, story_points: 0, first_time_count: 0, repeat_count: 0, repeat_percentage: 0 }
    const seen = new Set<string>()
    const unique = (member.tickets ?? []).filter((t: any) => {
      if (seen.has(t.ticket_key)) return false
      seen.add(t.ticket_key)
      return true
    })
    const firstPass = unique.filter((t: any) => !t.had_previous_returns)
    const repeatPass = unique.filter((t: any) => t.had_previous_returns)
    const sp = unique.reduce((s: number, t: any) => s + (t.story_points ?? 0), 0)
    return {
      ticket_count: unique.length,
      story_points: sp,
      first_time_count: firstPass.length,
      repeat_count: repeatPass.length,
      repeat_percentage: unique.length > 0 ? Math.round((repeatPass.length / unique.length) * 100) : 0,
    }
  }

  const allNames = new Set<string>()
  const w1Members: any[] = w1Data?.throughput?.per_qa_member_throughput ?? []
  const priorMembers: any[] = priorW1Data?.throughput?.per_qa_member_throughput ?? []
  for (const m of w1Members) allNames.add(m.qa_name)
  for (const m of priorMembers) allNames.add(m.qa_name)

  for (const name of allNames) {
    const todayMember = w1Members.find((m: any) => m.qa_name === name)
    const lbdMember = priorMembers.find((m: any) => m.qa_name === name)

    qaMembers.set(name, {
      qa_assignee: name,
      today_stats: buildStats(w1Members, name),
      today_tickets: (todayMember?.tickets ?? []).map(mapTicket),
      last_business_day_stats: buildStats(priorMembers, name),
      last_business_day_tickets: (lbdMember?.tickets ?? []).map(mapTicket),
    })
  }

  return Array.from(qaMembers.values())
}
