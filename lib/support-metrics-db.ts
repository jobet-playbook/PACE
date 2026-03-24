/**
 * Support Metrics — Supabase Read/Write
 *
 * writeSupportToDb  — called after Front API fetch, persists to 3 normalized tables
 * readSupportFromDb — called by live endpoint to avoid hitting Front API
 *
 * Tables (FK order):
 *   pace_support_daily_reports
 *     → pace_support_agent_stats  (delete + insert)
 *     → pace_support_issues       (delete + insert)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SupportMetricsData } from './support-workflow'

const SNAPSHOT_MAX_AGE_MS = 23 * 60 * 60 * 1000 // 23 h

// ── Write ────────────────────────────────────────────────────────────────────

export async function writeSupportToDb(
  supabase: SupabaseClient,
  data: SupportMetricsData
): Promise<void> {
  // ── 1. Upsert daily report ─────────────────────────────────────────────
  const { data: reportRow, error: reportErr } = await supabase
    .from('pace_support_daily_reports')
    .upsert(
      {
        report_date: data.report_date,
        window_days: data.window_days,
        total_tickets_resolved: data.total_tickets_resolved,
        total_pace_points: data.overall.total_pace_points ?? data.total_tickets_resolved,
        avg_cycle_time: data.overall.avg_cycle_time,
        median_cycle_time: data.overall.median_cycle_time,
        p90_cycle_time: data.overall.p90_cycle_time,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'report_date' }
    )
    .select('id')
    .single()

  if (reportErr || !reportRow) {
    console.error('⚠️ [Support DB] daily_reports upsert:', reportErr?.message)
    return
  }
  const reportId = reportRow.id

  // ── 2. Agent stats — delete + insert ───────────────────────────────────
  await supabase.from('pace_support_agent_stats').delete().eq('report_id', reportId)

  if (data.by_agent.length > 0) {
    const { error } = await supabase.from('pace_support_agent_stats').insert(
      data.by_agent.map(a => ({
        report_id: reportId,
        agent_name: a.agent_name,
        tickets_resolved: a.tickets_resolved,
        total_pace_points: a.total_pace_points ?? a.tickets_resolved,
        avg_cycle_time: a.avg_cycle_time,
        median_cycle_time: a.median_cycle_time,
        p90_cycle_time: a.p90_cycle_time,
      }))
    )
    if (error) console.error('⚠️ [Support DB] agent_stats insert:', error.message)
  }

  // ── 3. Issues — delete + insert ────────────────────────────────────────
  await supabase.from('pace_support_issues').delete().eq('report_id', reportId)

  if (data.issues.length > 0) {
    const { error } = await supabase.from('pace_support_issues').insert(
      data.issues.map(i => ({
        report_id: reportId,
        front_conversation_id: i.frontConversationId,
        client_name: i.clientName,
        summary: i.summary,
        priority: i.priority,
        weight: i.weight,
        status: i.status,
        assignee: i.assignee,
        date_opened: i.dateOpenedIso,
        date_resolved: i.dateResolvedIso,
        hours_to_resolve: i.hoursToResolve,
        exceeds_24_hours: i.exceeds24Hours,
      }))
    )
    if (error) console.error('⚠️ [Support DB] issues insert:', error.message)
  }

  console.log(`✅ [Support DB] Written for ${data.report_date}: ${data.total_tickets_resolved} tickets, ${data.by_agent.length} agents`)
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent SupportMetricsData if < 23 hours old, otherwise null.
 */
export async function readSupportFromDb(
  supabase: SupabaseClient
): Promise<SupportMetricsData | null> {
  // Get latest report
  const { data: report, error: reportErr } = await supabase
    .from('pace_support_daily_reports')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (reportErr || !report) return null

  const age = Date.now() - new Date(report.generated_at).getTime()
  if (age > SNAPSHOT_MAX_AGE_MS) return null

  // Fetch agent stats
  const { data: agentStats } = await supabase
    .from('pace_support_agent_stats')
    .select('*')
    .eq('report_id', report.id)

  // Fetch issues
  const { data: issues } = await supabase
    .from('pace_support_issues')
    .select('*')
    .eq('report_id', report.id)

  const by_agent = (agentStats ?? []).map(a => ({
    agent_name: a.agent_name,
    tickets_resolved: a.tickets_resolved,
    total_pace_points: a.total_pace_points ?? a.tickets_resolved,
    avg_cycle_time: parseFloat(a.avg_cycle_time ?? 0),
    median_cycle_time: parseFloat(a.median_cycle_time ?? 0),
    p90_cycle_time: parseFloat(a.p90_cycle_time ?? 0),
  }))

  const mappedIssues = (issues ?? []).map(i => ({
    id: `SUP-${(i.front_conversation_id as string).slice(-4).toUpperCase()}`,
    frontConversationId: i.front_conversation_id,
    clientName: i.client_name ?? 'Unknown',
    summary: i.summary ?? '',
    priority: (i.priority ?? 'Medium') as 'Critical' | 'High' | 'Medium' | 'Low',
    weight: i.weight ?? 1,
    status: (i.status ?? 'Resolved') as 'Resolved' | 'Open' | 'In Progress' | 'Pending Client',
    assignee: i.assignee ?? 'Unattributed',
    dateOpened: i.date_opened
      ? new Date(i.date_opened).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', timeZone: 'America/New_York' })
      : '',
    dateOpenedIso: i.date_opened ?? '',
    dateResolved: i.date_resolved
      ? new Date(i.date_resolved).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', timeZone: 'America/New_York' })
      : null,
    dateResolvedIso: i.date_resolved ?? null,
    hoursToResolve: i.hours_to_resolve !== null ? parseFloat(i.hours_to_resolve) : null,
    exceeds24Hours: i.exceeds_24_hours ?? false,
  }))

  const member_stats = by_agent.map(a => ({
    name: a.agent_name,
    issuesSolved: a.tickets_resolved,
    weightedPace: a.total_pace_points,
    avgResolutionHours: a.avg_cycle_time,
    over24HourCount: mappedIssues.filter(i => i.assignee === a.agent_name && i.exceeds24Hours).length,
  }))

  return {
    report_date: report.report_date,
    window_days: report.window_days,
    total_tickets_resolved: report.total_tickets_resolved,
    overall: {
      total_pace_points: report.total_pace_points ?? report.total_tickets_resolved,
      avg_cycle_time: parseFloat(report.avg_cycle_time ?? 0),
      median_cycle_time: parseFloat(report.median_cycle_time ?? 0),
      p90_cycle_time: parseFloat(report.p90_cycle_time ?? 0),
    },
    by_agent,
    issues: mappedIssues,
    member_stats,
  }
}
