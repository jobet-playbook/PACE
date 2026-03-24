/**
 * Documentation Metrics — Normalized Database Read/Write
 *
 * writeDocToNormalizedTables — called by sync cron
 * readDocFromNormalizedTables — called by the live endpoint to avoid hitting Jira
 *
 * Write order respects FK dependencies:
 *   pace_doc_daily_reports
 *     → pace_doc_window_metrics  (upsert w7 + prior_w7 + w28)
 *     → pace_doc_owner_metrics   (delete + insert)
 *     → pace_doc_exclusions      (delete + insert)
 *     → pace_doc_wip_tickets     (delete + insert)
 *   pace_doc_snapshots            (insert full payload)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DocData } from './documentation-workflow'

const SNAPSHOT_MAX_AGE_MS = 23 * 60 * 60 * 1000 // 23 h

// ── Write ────────────────────────────────────────────────────────────────────

export async function writeDocToNormalizedTables(
  supabase: SupabaseClient,
  docData: DocData
): Promise<void> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // ── 1. Upsert daily report ───────────────────────────────────────────────
  const { data: reportRow, error: reportErr } = await supabase
    .from('pace_doc_daily_reports')
    .upsert(
      {
        report_date: today,
        generated_at: new Date().toISOString(),
        status: docData.status,
        recommendations: docData.recommendations,
        weighted_sp_change_pct: docData.deltas.weighted_sp_change_pct,
        raw_sp_change_pct: docData.deltas.raw_sp_change_pct,
      },
      { onConflict: 'report_date' }
    )
    .select('id')
    .single()

  if (reportErr || !reportRow) {
    console.error('⚠️ [Doc DB] daily_reports upsert:', reportErr?.message)
    return
  }
  const reportId = reportRow.id

  // ── 2. Upsert window metrics (w7, prior_w7, w28) ────────────────────────
  for (const [windowType, metrics] of [
    ['w7', docData.w7],
    ['prior_w7', docData.prior_w7],
    ['w28', docData.w28],
  ] as const) {
    const { error } = await supabase
      .from('pace_doc_window_metrics')
      .upsert(
        {
          report_id: reportId,
          window_type: windowType,
          total_tickets: metrics.total_tickets,
          raw_story_points: metrics.raw_story_points,
          weighted_story_points: metrics.weighted_story_points,
          missing_story_points: metrics.missing_story_points,
          first_pass_sp: metrics.first_pass_sp,
          repeat_pass_sp: metrics.repeat_pass_sp,
          quality_issues: metrics.quality_issues,
          d_cycle_avg_days: metrics.d_cycle_avg_days,
          t_cycle_avg_days: metrics.t_cycle_avg_days,
          p1: metrics.pass_distribution.p1,
          p2: metrics.pass_distribution.p2,
          p3: metrics.pass_distribution.p3,
          p4plus: metrics.pass_distribution.p4plus,
        },
        { onConflict: 'report_id,window_type' }
      )
    if (error) console.error(`⚠️ [Doc DB] window_metrics upsert (${windowType}):`, error.message)
  }

  // ── 3. Owner metrics — delete today's rows then re-insert (w7, prior_w7, w28) ─
  await supabase.from('pace_doc_owner_metrics').delete().eq('report_id', reportId)

  const ownerRows = [
    ...docData.owners.map(o => ({ ...o, windowType: 'w7' })),
    ...docData.prior_w7_owners.map(o => ({ ...o, windowType: 'prior_w7' })),
    ...docData.monthly_owners.map(o => ({ ...o, windowType: 'w28' })),
  ]
  if (ownerRows.length > 0) {
    const { error } = await supabase.from('pace_doc_owner_metrics').insert(
      ownerRows.map(o => ({
        report_id: reportId,
        owner: o.owner,
        window_type: o.windowType,
        ticket_count: o.ticket_count,
        ticket_keys: o.ticket_keys,
        raw_sp: o.raw_sp,
        weighted_sp: o.weighted_sp,
        missing_sp: o.missing_sp,
        first_pass_count: o.first_pass_count,
        repeat_pass_count: o.repeat_pass_count,
        first_pass_sp: o.first_pass_sp,
        repeat_pass_sp: o.repeat_pass_sp,
      }))
    )
    if (error) console.error('⚠️ [Doc DB] owner_metrics insert:', error.message)
  }

  // ── 4. Exclusions — delete today's rows then re-insert ───────────────────
  await supabase.from('pace_doc_exclusions').delete().eq('report_id', reportId)

  if (docData.exclusions.length > 0) {
    const { error } = await supabase.from('pace_doc_exclusions').insert(
      docData.exclusions.map(ex => {
        const last = ex.pushback_history[ex.pushback_history.length - 1]
        return {
          report_id: reportId,
          ticket_key: ex.key,
          pass_count: ex.pass_count,
          last_assignee: last?.assignee ?? null,
          last_status: last?.pushback_activity?.status ?? null,
          pushback_history: ex.pushback_history,
        }
      })
    )
    if (error) console.error('⚠️ [Doc DB] exclusions insert:', error.message)
  }

  // ── 5. WIP tickets — delete today's rows then re-insert ──────────────────
  await supabase.from('pace_doc_wip_tickets').delete().eq('report_id', reportId)

  const allWip = [
    ...docData.wip.old_prd_wip_tickets,
    ...docData.wip.critical_prd_wip_tickets,
  ]
  // Deduplicate by key
  const wipMap = new Map<string, typeof allWip[0]>()
  for (const t of allWip) wipMap.set(t.key, t)
  // Also include any WIP tickets not in old/critical lists
  // We don't have the full list directly, but old + critical covers our needs

  if (wipMap.size > 0) {
    const { error } = await supabase.from('pace_doc_wip_tickets').insert(
      Array.from(wipMap.values()).map(t => ({
        report_id: reportId,
        ticket_key: t.key,
        summary: t.summary,
        creator: t.creator,
        assignee: t.assignee,
        developer: t.developer,
        story_points: t.story_points,
        priority: t.priority,
        status: t.status,
        age_bd: t.age_bd,
        recent_age_bd: t.recent_age_bd,
        first_tracked_date: t.first_tracked_date,
        latest_tracked_date: t.latest_tracked_date,
        tracked_pass_count: t.tracked_pass_count,
      }))
    )
    if (error) console.error('⚠️ [Doc DB] wip_tickets insert:', error.message)
  }

  // ── 6. Insert full snapshot ───────────────────────────────────────────────
  const { error: snapErr } = await supabase
    .from('pace_doc_snapshots')
    .insert({ source: 'sync', data: docData })
  if (snapErr) console.error('⚠️ [Doc DB] snapshots insert:', snapErr.message)

  console.log(`✅ [Doc DB] Written for ${today}: ${docData.w7.total_tickets} tickets, ${docData.owners.length} owners, ${docData.exclusions.length} exclusions`)
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent DocData snapshot if it is < 23 hours old, otherwise null.
 * The live endpoint calls this before falling back to the Jira API.
 */
export async function readDocFromNormalizedTables(
  supabase: SupabaseClient
): Promise<DocData | null> {
  const { data, error } = await supabase
    .from('pace_doc_snapshots')
    .select('data, synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  const age = Date.now() - new Date(data.synced_at).getTime()
  if (age > SNAPSHOT_MAX_AGE_MS) return null

  const d = data.data as DocData

  // Schema-version guard: if the snapshot was written before we added
  // critical fields, force a live Jira re-fetch.
  if (
    d?.w7?.d_cycle_avg_days   === undefined ||
    d?.w7?.t_cycle_avg_days   === undefined ||
    d?.w7?.quality_issues      === undefined ||
    d?.w7?.first_pass_sp       === undefined ||
    d?.prior_w7_owners         === undefined ||
    d?.monthly_owners          === undefined ||
    d?.w28                     === undefined ||
    d?.wip                     === undefined
  ) {
    console.log('⚠️ [Doc DB] Snapshot schema outdated — forcing live re-fetch')
    return null
  }

  return d
}
