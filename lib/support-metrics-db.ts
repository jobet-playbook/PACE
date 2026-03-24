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

  // Update last_synced_at
  await supabase
    .from('pace_support_daily_reports')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', reportId)

  console.log(`✅ [Support DB] Written for ${data.report_date}: ${data.total_tickets_resolved} tickets, ${data.by_agent.length} agents`)
}

// ── Incremental Merge ────────────────────────────────────────────────────────

/**
 * Get the last_synced_at timestamp for the most recent report.
 * Returns null if no report exists.
 */
export async function getLastSyncedAt(
  supabase: SupabaseClient
): Promise<{ reportId: string; lastSyncedAt: Date; reportDate: string } | null> {
  const { data, error } = await supabase
    .from('pace_support_daily_reports')
    .select('id, last_synced_at, report_date')
    .order('generated_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data || !data.last_synced_at) return null
  return {
    reportId: data.id,
    lastSyncedAt: new Date(data.last_synced_at),
    reportDate: data.report_date,
  }
}

/**
 * Merge new issues into existing report via upsert (by front_conversation_id).
 * Then recompute agent_stats from the full issue set in DB.
 */
export async function mergeSupportIncremental(
  supabase: SupabaseClient,
  reportId: string,
  newIssues: import('./support-workflow').SupportIssueData[]
): Promise<void> {
  if (newIssues.length === 0) {
    console.log('📬 [Support DB] No new issues to merge')
    return
  }

  // Upsert new issues by front_conversation_id
  const { error: issueErr } = await supabase
    .from('pace_support_issues')
    .upsert(
      newIssues.map(i => ({
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
      })),
      { onConflict: 'report_id,front_conversation_id' }
    )

  if (issueErr) {
    console.error('⚠️ [Support DB] Issue upsert failed:', issueErr.message)
    return
  }
  console.log(`📬 [Support DB] Merged ${newIssues.length} new issues`)

  // Recompute agent_stats from full issue set in DB
  await recomputeAgentStats(supabase, reportId)

  // Update last_synced_at and report totals
  const { data: allIssues } = await supabase
    .from('pace_support_issues')
    .select('hours_to_resolve, weight, exceeds_24_hours')
    .eq('report_id', reportId)

  const issues = allIssues ?? []
  const cycleTimes = issues.map(i => parseFloat(i.hours_to_resolve ?? 0))
  const totalPace = issues.reduce((s, i) => s + (i.weight ?? 1), 0)
  const sorted = [...cycleTimes].sort((a, b) => a - b)

  await supabase
    .from('pace_support_daily_reports')
    .update({
      total_tickets_resolved: issues.length,
      total_pace_points: totalPace,
      avg_cycle_time: cycleTimes.length > 0 ? parseFloat((cycleTimes.reduce((s, v) => s + v, 0) / cycleTimes.length).toFixed(2)) : 0,
      median_cycle_time: sorted.length > 0
        ? (sorted.length % 2 !== 0 ? sorted[Math.floor(sorted.length / 2)] : parseFloat(((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(2)))
        : 0,
      p90_cycle_time: sorted.length > 0 ? parseFloat(sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)].toFixed(2)) : 0,
      last_synced_at: new Date().toISOString(),
      generated_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  console.log(`✅ [Support DB] Incremental merge done: ${issues.length} total issues, ${totalPace} pace pts`)
}

/**
 * Recompute agent_stats from all issues in DB for a given report.
 */
async function recomputeAgentStats(
  supabase: SupabaseClient,
  reportId: string
): Promise<void> {
  const { data: issues } = await supabase
    .from('pace_support_issues')
    .select('assignee, hours_to_resolve, weight, exceeds_24_hours')
    .eq('report_id', reportId)

  if (!issues || issues.length === 0) return

  // Group by agent
  const agentMap = new Map<string, { cycleTimes: number[]; pacePoints: number; count: number }>()
  for (const i of issues) {
    const name = i.assignee ?? 'Unattributed'
    if (!agentMap.has(name)) agentMap.set(name, { cycleTimes: [], pacePoints: 0, count: 0 })
    const a = agentMap.get(name)!
    a.cycleTimes.push(parseFloat(i.hours_to_resolve ?? 0))
    a.pacePoints += i.weight ?? 1
    a.count++
  }

  // Delete + insert agent stats (small table, always recomputed from full issue set)
  await supabase.from('pace_support_agent_stats').delete().eq('report_id', reportId)

  const rows = Array.from(agentMap.entries()).map(([name, data]) => {
    const sorted = [...data.cycleTimes].sort((a, b) => a - b)
    return {
      report_id: reportId,
      agent_name: name,
      tickets_resolved: data.count,
      total_pace_points: data.pacePoints,
      avg_cycle_time: data.cycleTimes.length > 0 ? parseFloat((data.cycleTimes.reduce((s, v) => s + v, 0) / data.cycleTimes.length).toFixed(2)) : 0,
      median_cycle_time: sorted.length > 0
        ? (sorted.length % 2 !== 0 ? sorted[Math.floor(sorted.length / 2)] : parseFloat(((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(2)))
        : 0,
      p90_cycle_time: sorted.length > 0 ? parseFloat(sorted[Math.max(0, Math.ceil(sorted.length * 0.9) - 1)].toFixed(2)) : 0,
    }
  })

  const { error } = await supabase.from('pace_support_agent_stats').insert(rows)
  if (error) console.error('⚠️ [Support DB] agent_stats recompute failed:', error.message)
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
    id: `SUP-${i.front_conversation_id}`,
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
