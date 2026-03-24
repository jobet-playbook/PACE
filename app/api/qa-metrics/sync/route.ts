import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createJiraClient } from '@/lib/jira-client'
import { JiraWorkflowProcessor } from '@/lib/jira-workflow'
import { cachePool, CacheKeys } from '@/lib/cache-pool'
import { writeToNormalizedTables, readFromNormalizedTables } from '@/lib/qa-metrics-db'

/**
 * POST /api/qa-metrics/sync
 *
 * Fetches fresh QA metrics from Jira, processes them, then writes to the
 * normalized pace_qa_* tables. The live endpoint reads from those tables
 * instead of calling Jira on every dashboard load.
 *
 * Intended to be called by the Vercel daily cron (see vercel.json) and
 * optionally via a manual "Refresh" button in the UI.
 *
 * Auth: Bearer token from CRON_SECRET env var.
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const expectedToken = process.env.CRON_SECRET
  if (expectedToken) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured' },
      { status: 500 }
    )
  }

  const jiraBaseUrl = process.env.JIRA_BASE_URL
  const jiraEmail = process.env.JIRA_EMAIL
  const jiraToken = process.env.JIRA_API_TOKEN

  if (!jiraBaseUrl || !jiraEmail || !jiraToken || jiraToken.includes('BLANK_VALUE')) {
    return NextResponse.json(
      { error: 'Jira credentials not configured' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'full'
    const isIncremental = mode === 'incremental'

    console.log(`🔄 [Sync] Starting ${isIncremental ? 'incremental' : 'full'} Jira sync at:`, new Date().toISOString())

    // ── Fetch & process from Jira ─────────────────────────────────────────
    const jiraClient = createJiraClient()
    const processor = new JiraWorkflowProcessor(jiraClient)

    // Incremental: only fetch w7 + daily windows (skip w28, prior_w7, prior_w28)
    // Full: fetch all 6 windows
    const windowFilter = isIncremental ? ['w7'] : undefined
    console.log(`📊 [Sync] Processing ${isIncremental ? 'w7 + daily' : 'all'} rollback windows...`)
    let rollback_windows = await processor.processAllWindows(windowFilter)

    // In incremental mode, merge with existing DB data for missing windows
    if (isIncremental) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const existing = await readFromNormalizedTables(supabase)
      if (existing?.rollback_windows) {
        // Keep cached w28/prior windows, overlay fresh w7/w1/prior_w1
        rollback_windows = {
          ...existing.rollback_windows,
          ...rollback_windows,
        }
        console.log('📊 [Sync] Merged fresh w7+daily with cached w28/prior windows')
      }
    }

    // Deduplicate critical / old WIP tickets across windows
    const seenCritical = new Set<string>()
    const seenOld = new Set<string>()
    const critical_qa_wip_tickets: any[] = []
    const old_qa_wip_tickets: any[] = []

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

    // ── Build last_30_business_days from w28 window ───────────────────────
    const w28Throughput = rollback_windows.w28?.throughput
    const w28Tickets: any[] =
      w28Throughput?.per_qa_member_throughput?.flatMap((m: any) => m.tickets ?? []) ?? []
    const actualFirstPassCount = w28Tickets.filter((t: any) => !t.had_previous_returns).length
    const actualRepeatCount = w28Tickets.filter((t: any) => t.had_previous_returns).length
    const actualFirstPassSP = w28Tickets
      .filter((t: any) => !t.had_previous_returns)
      .reduce((sum: number, t: any) => sum + (t.story_points ?? 0), 0)
    const actualRepeatSP = w28Tickets
      .filter((t: any) => t.had_previous_returns)
      .reduce((sum: number, t: any) => sum + (t.story_points ?? 0), 0)

    const last_30_business_days = {
      total_tickets: w28Throughput?.total_tickets ?? 0,
      story_points: w28Throughput?.total_story_points ?? 0,
      first_qa_cycle: { ticket_count: actualFirstPassCount, story_points: actualFirstPassSP },
      returning_qa_cycle: { ticket_count: actualRepeatCount, story_points: actualRepeatSP },
      qa_handlers: (w28Throughput?.per_qa_member_throughput ?? []).map((m: any) => ({
        qa_assignee: m.qa_name,
        handled_ticket_count: m.unique_ticket_count,
        handled_ticket_story_points: m.unique_ticket_story_points,
      })),
    }

    // ── Build people from daily windows (w1=today, prior_w1=yesterday) ──────
    const people = buildPeopleData(rollback_windows.w1, rollback_windows.prior_w1)

    // ── Assemble full snapshot payload ────────────────────────────────────
    const snapshotData = {
      output: {
        report_meta: {
          generated_at_et: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
          report_type: 'Daily QA Performance Report',
          today_label: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
          }),
        },
        people,
      },
      rollback_windows,
      last_30_business_days,
      critical_qa_wip_tickets,
      old_qa_wip_tickets,
    }

    // ── Write to normalized tables ────────────────────────────────────────
    const supabase = createClient(supabaseUrl, supabaseKey)
    await writeToNormalizedTables(supabase, snapshotData)
    console.log('✅ [Sync] Written to normalized pace_qa_* tables')

    // ── Invalidate cache so live endpoint picks up new data ───────────────
    await cachePool.clear(CacheKeys.LIVE_METRICS)
    console.log('🗑️ [Sync] Cache pool cleared')

    return NextResponse.json({
      success: true,
      mode,
      synced_at: new Date().toISOString(),
      stats: {
        rollback_windows: Object.keys(rollback_windows).length,
        critical_wip_tickets: critical_qa_wip_tickets.length,
        old_wip_tickets: old_qa_wip_tickets.length,
        w28_total_tickets: last_30_business_days.total_tickets,
        w28_first_pass: last_30_business_days.first_qa_cycle.ticket_count,
        w28_repeat_pass: last_30_business_days.returning_qa_cycle.ticket_count,
      },
    })
  } catch (error) {
    console.error('❌ [Sync] Error:', error)
    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/qa-metrics/sync
 *
 * If called with a valid Authorization header (Vercel cron), triggers a sync.
 * Otherwise returns the last sync timestamp.
 */
export async function GET(request: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const expectedToken = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (expectedToken && authHeader === `Bearer ${expectedToken}`) {
    return POST(request)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ lastSync: null })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('pace_qa_daily_reports')
      .select('generated_at')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ lastSync: null, message: 'No reports found' })
    }

    return NextResponse.json({
      lastSync: data.generated_at,
      source: 'normalized',
      message: 'Last sync completed successfully',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to check sync status' }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds people data from w1 (today) and prior_w1 (previous day) daily windows.
 * These windows use individually-fetched full changelogs for accurate completion dates.
 */
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

  // Collect all QA member names from both daily windows
  const allNames = new Set<string>()
  for (const m of w1Data?.throughput?.per_qa_member_throughput ?? []) allNames.add(m.qa_name)
  for (const m of priorW1Data?.throughput?.per_qa_member_throughput ?? []) allNames.add(m.qa_name)

  const w1Members: any[] = w1Data?.throughput?.per_qa_member_throughput ?? []
  const priorMembers: any[] = priorW1Data?.throughput?.per_qa_member_throughput ?? []

  for (const name of allNames) {
    const todayMember = w1Members.find((m: any) => m.qa_name === name)
    const todayTickets = todayMember?.tickets ?? []

    const lbdMember = priorMembers.find((m: any) => m.qa_name === name)
    const lbdTickets = lbdMember?.tickets ?? []

    qaMembers.set(name, {
      qa_assignee: name,
      today_stats: buildStats(w1Members, name),
      today_tickets: todayTickets.map(mapTicket),
      last_business_day_stats: buildStats(priorMembers, name),
      last_business_day_tickets: lbdTickets.map(mapTicket),
    })
  }

  return Array.from(qaMembers.values())
}

function getLastBusinessDay(): Date {
  const date = new Date()
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 1 ? 3 : day === 0 ? 2 : 1))
  return date
}
