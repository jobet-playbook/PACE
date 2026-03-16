/**
 * QA Metrics — Normalized Database Read/Write
 *
 * writeToNormalizedTables  — called by sync cron and Jira live-fallback
 * readFromNormalizedTables — called by the live endpoint (reads fresh data
 *                            without touching Jira)
 *
 * Write order respects FK dependencies:
 *   team_members → tickets → daily_report
 *     → daily_member_stats
 *     → ticket_completions (delete+insert)
 *     → wip_tickets        (delete+insert)
 *     → rollback_windows
 *     → 30day_summary → member_30day_throughput
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const SNAPSHOT_MAX_AGE_MS = 23 * 60 * 60 * 1000 // 23 h

// ── Write ────────────────────────────────────────────────────────────────────

export async function writeToNormalizedTables(
  supabase: SupabaseClient,
  snapshotData: any
): Promise<void> {
  const {
    output,
    rollback_windows,
    last_30_business_days,
    critical_qa_wip_tickets,
    old_qa_wip_tickets,
  } = snapshotData

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // ── 1. Upsert team members ───────────────────────────────────────────────
  const qaNames = new Set<string>()
  for (const p of output.people ?? []) {
    if (p.qa_assignee) qaNames.add(p.qa_assignee)
  }
  for (const t of [...(critical_qa_wip_tickets ?? []), ...(old_qa_wip_tickets ?? [])]) {
    if (t.assignee) qaNames.add(t.assignee)
  }

  const memberIds = new Map<string, string>()
  for (const name of qaNames) {
    const { data, error } = await supabase
      .from('pace_qa_team_members')
      .upsert({ name }, { onConflict: 'name' })
      .select('id, name')
      .single()
    if (error) console.error(`⚠️ [DB] team_member upsert "${name}":`, error.message)
    else if (data) memberIds.set(data.name, data.id)
  }

  // ── 2. Upsert tickets (completions + WIP) ────────────────────────────────
  // Build a map of ticket_key → { story_points, summary, priority }
  const ticketMap = new Map<string, { sp: number | null; summary: string | null; priority: string | null }>()

  for (const p of output.people ?? []) {
    for (const t of p.today_tickets ?? []) {
      ticketMap.set(t.ticket_id, { sp: t.story_points ?? null, summary: null, priority: null })
    }
  }
  for (const t of [...(critical_qa_wip_tickets ?? []), ...(old_qa_wip_tickets ?? [])]) {
    ticketMap.set(t.ticket_key, {
      sp: t.story_points ?? null,
      summary: t.summary ?? null,
      priority: t.priority ?? null,
    })
  }

  const ticketIds = new Map<string, string>()
  for (const [ticket_key, { sp, summary, priority }] of ticketMap) {
    const { data, error } = await supabase
      .from('pace_qa_tickets')
      .upsert({ ticket_key, story_points: sp, summary, priority }, { onConflict: 'ticket_key' })
      .select('id, ticket_key')
      .single()
    if (error) console.error(`⚠️ [DB] ticket upsert "${ticket_key}":`, error.message)
    else if (data) ticketIds.set(data.ticket_key, data.id)
  }

  // ── 3. Upsert daily report ───────────────────────────────────────────────
  const { data: report, error: reportError } = await supabase
    .from('pace_qa_daily_reports')
    .upsert(
      {
        report_date: today,
        generated_at: new Date().toISOString(),
        report_type: output.report_meta?.report_type ?? 'Daily QA Performance Report',
        status: 'GREEN',
      },
      { onConflict: 'report_date' }
    )
    .select('id')
    .single()

  if (reportError || !report) {
    throw new Error(`Failed to upsert daily report: ${reportError?.message}`)
  }
  const reportId: string = report.id

  // ── 4. Upsert daily member stats ─────────────────────────────────────────
  for (const person of output.people ?? []) {
    const memberId = memberIds.get(person.qa_assignee)
    if (!memberId) continue

    const { error } = await supabase.from('pace_qa_daily_member_stats').upsert(
      {
        report_id: reportId,
        member_id: memberId,
        report_date: today,
        tickets_completed: person.today_stats?.ticket_count ?? 0,
        story_points_completed: person.today_stats?.story_points ?? 0,
        first_time_pass_count: person.today_stats?.first_time_count ?? 0,
        repeat_pass_count: person.today_stats?.repeat_count ?? 0,
        repeat_percentage: person.today_stats?.repeat_percentage ?? 0,
      },
      { onConflict: 'report_id,member_id' }
    )
    if (error) console.error(`⚠️ [DB] member_stats upsert "${person.qa_assignee}":`, error.message)
  }

  // ── 5. Delete + insert ticket completions for this report ────────────────
  await supabase.from('pace_qa_ticket_completions').delete().eq('report_id', reportId)

  const completions: any[] = []
  for (const person of output.people ?? []) {
    const memberId = memberIds.get(person.qa_assignee)
    if (!memberId) continue

    for (const ticket of person.today_tickets ?? []) {
      const ticketId = ticketIds.get(ticket.ticket_id)
      if (!ticketId) continue

      completions.push({
        ticket_id: ticketId,
        member_id: memberId,
        report_id: reportId,
        completed_at: new Date().toISOString(),
        completion_date: today,
        completion_time: ticket.completed_time_et,
        handled_stage: ticket.handled_stage,
        new_stage: ticket.new_stage ?? 'Done',
        pass_type: ticket.pass_type,
        qa_return_cycles_count: ticket.qa_return_cycles_count ?? 0,
        had_previous_returns: ticket.had_previous_returns ?? false,
        story_points: ticket.story_points,
        recap: ticket.recap,
      })
    }
  }

  if (completions.length > 0) {
    const { error } = await supabase.from('pace_qa_ticket_completions').insert(completions)
    if (error) console.error('⚠️ [DB] ticket_completions insert:', error.message)
  }

  // ── 6. Delete + insert WIP tickets for today ─────────────────────────────
  await supabase.from('pace_qa_wip_tickets').delete().eq('snapshot_date', today)

  const seenWip = new Set<string>()
  const wips: any[] = []
  const allWip = [...(critical_qa_wip_tickets ?? []), ...(old_qa_wip_tickets ?? [])]

  for (const ticket of allWip) {
    if (seenWip.has(ticket.ticket_key)) continue
    seenWip.add(ticket.ticket_key)

    const ticketId = ticketIds.get(ticket.ticket_key)
    const assigneeId = memberIds.get(ticket.assignee)
    if (!ticketId || !assigneeId) continue

    wips.push({
      ticket_id: ticketId,
      assignee_id: assigneeId,
      developer_name: ticket.developer ?? null,
      initial_qa_date: ticket.initial_qa_date ?? new Date().toISOString(),
      latest_qa_date: ticket.latest_qa_date ?? new Date().toISOString(),
      qa_repetition_count: ticket.qa_repetition_count ?? 0,
      qa_status: ticket.qa_status ?? null,
      age_business_days: ticket.age_bd ?? 0,
      recent_age_business_days: ticket.recent_age_bd ?? 0,
      is_critical: (critical_qa_wip_tickets ?? []).some((t: any) => t.ticket_key === ticket.ticket_key),
      is_old: (old_qa_wip_tickets ?? []).some((t: any) => t.ticket_key === ticket.ticket_key),
      snapshot_date: today,
      report_id: reportId,
    })
  }

  if (wips.length > 0) {
    const { error } = await supabase.from('pace_qa_wip_tickets').insert(wips)
    if (error) console.error('⚠️ [DB] wip_tickets insert:', error.message)
  }

  // ── 7. Upsert rollback windows ───────────────────────────────────────────
  for (const [windowType, data] of Object.entries(rollback_windows ?? {})) {
    const d = data as any
    const { error } = await supabase.from('pace_qa_rollback_windows').upsert(
      {
        report_id: reportId,
        window_type: windowType,
        window_description: d.rollback_window_description,
        to_qa_avg_bd: d.cycle_time?.to_qa_avg_bd ?? null,
        to_done_avg_bd: d.cycle_time?.to_done_avg_bd ?? null,
        to_pushback_avg_bd: d.cycle_time?.to_pushback_avg_bd ?? null,
        total_story_points: d.throughput?.total_story_points ?? 0,
        total_qa_phase_story_points: d.throughput?.total_qa_phase_story_points ?? 0,
        total_tickets: d.throughput?.total_tickets ?? 0,
        qa_in_progress_tickets: d.qa_in_progress?.total_tickets ?? 0,
        qa_in_progress_story_points: d.qa_in_progress?.total_story_points ?? 0,
        old_wip_tickets_count: d.qa_in_progress?.old_qa_wip_tickets?.length ?? 0,
        critical_wip_tickets_count: d.qa_in_progress?.critical_qa_wip_tickets?.length ?? 0,
        escaped_defects_count: d.defects?.escaped_defects_count ?? 0,
        critical_defects_total: d.defects?.critical_defects?.total_count ?? 0,
        critical_defects_unresolved: d.defects?.critical_defects?.unresolved_count ?? 0,
        critical_defects_resolved: d.defects?.critical_defects?.resolved_count ?? 0,
        per_member_throughput: d.throughput?.per_qa_member_throughput ?? [],
        per_member_wip: d.qa_in_progress?.per_qa_member_qa_in_progress ?? [],
      },
      { onConflict: 'report_id,window_type' }
    )
    if (error) console.error(`⚠️ [DB] rollback_window "${windowType}" upsert:`, error.message)
  }

  // ── 8. Upsert 30-day summary + per-member throughput ────────────────────
  const { data: summary, error: summaryError } = await supabase
    .from('pace_qa_30day_summary')
    .upsert(
      {
        report_id: reportId,
        total_tickets: last_30_business_days?.total_tickets ?? 0,
        first_qa_cycle_tickets: last_30_business_days?.first_qa_cycle?.ticket_count ?? 0,
        returning_qa_cycle_tickets: last_30_business_days?.returning_qa_cycle?.ticket_count ?? 0,
        total_story_points: last_30_business_days?.story_points ?? 0,
        first_qa_cycle_story_points: last_30_business_days?.first_qa_cycle?.story_points ?? 0,
        returning_qa_cycle_story_points: last_30_business_days?.returning_qa_cycle?.story_points ?? 0,
      },
      { onConflict: 'report_id' }
    )
    .select('id')
    .single()

  if (summaryError) {
    console.error('⚠️ [DB] 30day_summary upsert:', summaryError.message)
    return
  }

  const throughputs = (last_30_business_days?.qa_handlers ?? [])
    .map((h: any) => ({
      summary_id: summary.id,
      member_id: memberIds.get(h.qa_assignee),
      handled_ticket_count: h.handled_ticket_count ?? 0,
      handled_ticket_story_points: h.handled_ticket_story_points ?? 0,
    }))
    .filter((t: any) => t.member_id)

  if (throughputs.length > 0) {
    const { error } = await supabase
      .from('pace_qa_member_30day_throughput')
      .upsert(throughputs, { onConflict: 'summary_id,member_id' })
    if (error) console.error('⚠️ [DB] member_30day_throughput upsert:', error.message)
  }
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function readFromNormalizedTables(supabase: SupabaseClient): Promise<any | null> {
  // Get the latest daily report
  const { data: report, error: reportError } = await supabase
    .from('pace_qa_daily_reports')
    .select('*')
    .order('report_date', { ascending: false })
    .limit(1)
    .single()

  if (reportError || !report) return null

  // Check freshness (< 23 h)
  const ageMs = Date.now() - new Date(report.generated_at).getTime()
  if (ageMs > SNAPSHOT_MAX_AGE_MS) return null

  // Fetch all related data in parallel
  const [memberStatsRes, completionsRes, rollbackWindowsRes, wipTicketsRes, summaryRes] =
    await Promise.all([
      supabase
        .from('pace_qa_daily_member_stats')
        .select('*, member:pace_qa_team_members(name)')
        .eq('report_id', report.id),

      supabase
        .from('pace_qa_ticket_completions')
        .select('*, ticket:pace_qa_tickets(ticket_key, story_points)')
        .eq('report_id', report.id),

      supabase
        .from('pace_qa_rollback_windows')
        .select('*')
        .eq('report_id', report.id),

      supabase
        .from('pace_qa_wip_tickets')
        .select(
          '*, ticket:pace_qa_tickets(ticket_key, story_points, summary, priority), assignee:pace_qa_team_members(name)'
        )
        .eq('snapshot_date', report.report_date),

      supabase
        .from('pace_qa_30day_summary')
        .select(
          '*, member_throughput:pace_qa_member_30day_throughput(*, member:pace_qa_team_members(name))'
        )
        .eq('report_id', report.id)
        .single(),
    ])

  if (memberStatsRes.error || rollbackWindowsRes.error) {
    console.error('⚠️ [DB] Read error:', memberStatsRes.error ?? rollbackWindowsRes.error)
    return null
  }

  const memberStats: any[] = memberStatsRes.data ?? []
  const completions: any[] = completionsRes.data ?? []
  const rollbackWindows: any[] = rollbackWindowsRes.data ?? []
  const wipTickets: any[] = wipTicketsRes.data ?? []
  const summary: any = summaryRes.data

  // ── Build people (from member stats + ticket completions) ────────────────
  const people = memberStats.map(ms => {
    const memberCompletions = completions.filter(c => c.member_id === ms.member_id)
    return {
      qa_assignee: ms.member?.name ?? '',
      today_stats: {
        ticket_count: ms.tickets_completed,
        story_points: ms.story_points_completed,
        first_time_count: ms.first_time_pass_count,
        repeat_count: ms.repeat_pass_count,
        repeat_percentage: ms.repeat_percentage,
      },
      today_tickets: memberCompletions.map((c: any) => ({
        ticket_id: c.ticket?.ticket_key ?? '',
        completed_time_et: c.completion_time,
        story_points: c.story_points,
        handled_stage: c.handled_stage,
        new_stage: c.new_stage,
        pass_type: c.pass_type,
        qa_return_cycles_count: c.qa_return_cycles_count,
        had_previous_returns: c.had_previous_returns,
        recap: c.recap,
      })),
      last_business_day_stats: {
        ticket_count: 0, story_points: 0, first_time_count: 0, repeat_count: 0, repeat_percentage: 0,
      },
      last_business_day_tickets: [],
    }
  })

  // ── Build rollback_windows ────────────────────────────────────────────────
  const rollbackWindowsMap: Record<string, any> = {}
  for (const w of rollbackWindows) {
    const criticalWip = wipTickets.filter(t => t.is_critical).map(mapWipTicket)
    const oldWip = wipTickets.filter(t => t.is_old).map(mapWipTicket)
    rollbackWindowsMap[w.window_type] = {
      rollback_window_description: w.window_description,
      cycle_time: {
        to_qa_avg_bd: w.to_qa_avg_bd,
        to_done_avg_bd: w.to_done_avg_bd,
        to_pushback_avg_bd: w.to_pushback_avg_bd,
      },
      throughput: {
        total_story_points: w.total_story_points,
        total_qa_phase_story_points: w.total_qa_phase_story_points,
        total_tickets: w.total_tickets,
        per_qa_member_throughput: w.per_member_throughput ?? [],
      },
      qa_in_progress: {
        total_tickets: w.qa_in_progress_tickets,
        total_story_points: w.qa_in_progress_story_points,
        old_qa_wip_tickets: oldWip,
        critical_qa_wip_tickets: criticalWip,
        per_qa_member_qa_in_progress: w.per_member_wip ?? [],
      },
      defects: {
        escaped_defects_count: w.escaped_defects_count,
        critical_defects: {
          total_count: w.critical_defects_total,
          unresolved_count: w.critical_defects_unresolved,
          resolved_count: w.critical_defects_resolved,
        },
      },
    }
  }

  // ── Build last_30_business_days ──────────────────────────────────────────
  const last_30_business_days = summary
    ? {
        total_tickets: summary.total_tickets,
        story_points: summary.total_story_points,
        first_qa_cycle: {
          ticket_count: summary.first_qa_cycle_tickets,
          story_points: summary.first_qa_cycle_story_points,
        },
        returning_qa_cycle: {
          ticket_count: summary.returning_qa_cycle_tickets,
          story_points: summary.returning_qa_cycle_story_points,
        },
        qa_handlers: (summary.member_throughput ?? []).map((mt: any) => ({
          qa_assignee: mt.member?.name ?? '',
          handled_ticket_count: mt.handled_ticket_count,
          handled_ticket_story_points: mt.handled_ticket_story_points,
        })),
      }
    : {
        total_tickets: 0,
        story_points: 0,
        first_qa_cycle: { ticket_count: 0, story_points: 0 },
        returning_qa_cycle: { ticket_count: 0, story_points: 0 },
        qa_handlers: [],
      }

  const critical_qa_wip_tickets = wipTickets.filter(t => t.is_critical).map(mapWipTicket)
  const old_qa_wip_tickets = wipTickets.filter(t => t.is_old).map(mapWipTicket)

  console.log(`💾 [DB] Normalized read hit (report_date: ${report.report_date})`)

  return {
    output: {
      report_meta: {
        generated_at_et: new Date(report.generated_at).toLocaleString('en-US', {
          timeZone: 'America/New_York',
        }),
        report_type: report.report_type,
        today_label: new Date(report.report_date + 'T12:00:00Z').toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
        }),
        last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
        }),
      },
      people,
    },
    rollback_windows: rollbackWindowsMap,
    last_30_business_days,
    critical_qa_wip_tickets,
    old_qa_wip_tickets,
    _synced_at: report.generated_at,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapWipTicket(t: any) {
  return {
    ticket_key: t.ticket?.ticket_key ?? '',
    story_points: t.ticket?.story_points ?? null,
    summary: t.ticket?.summary ?? null,
    priority: t.ticket?.priority ?? null,
    assignee: t.assignee?.name ?? '',
    developer: t.developer_name,
    initial_qa_date: t.initial_qa_date,
    latest_qa_date: t.latest_qa_date,
    qa_repetition_count: t.qa_repetition_count,
    qa_status: t.qa_status,
    age_bd: t.age_business_days,
    recent_age_bd: t.recent_age_business_days,
  }
}

export function getLastBusinessDay(): Date {
  const date = new Date()
  const day = date.getDay()
  date.setDate(date.getDate() - (day === 1 ? 3 : day === 0 ? 2 : 1))
  return date
}
