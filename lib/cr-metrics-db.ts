/**
 * Code Review Metrics — Normalized Database Read/Write
 *
 * writeCRToNormalizedTables — called by sync cron
 * readCRFromNormalizedTables — called by the live endpoint to avoid hitting Jira
 *
 * Write order respects FK dependencies:
 *   pace_cr_daily_reports
 *     → pace_cr_window_metrics  (upsert w7 + prior_w7)
 *     → pace_cr_owner_metrics   (delete + insert)
 *     → pace_cr_exclusions      (delete + insert)
 *   pace_cr_snapshots            (insert full payload)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CRData } from './code-review-workflow'

const SNAPSHOT_MAX_AGE_MS = 23 * 60 * 60 * 1000 // 23 h

// ── Write ────────────────────────────────────────────────────────────────────

export async function writeCRToNormalizedTables(
  supabase: SupabaseClient,
  crData: CRData
): Promise<void> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // ── 1. Upsert daily report ───────────────────────────────────────────────
  const { data: reportRow, error: reportErr } = await supabase
    .from('pace_cr_daily_reports')
    .upsert(
      {
        report_date: today,
        generated_at: new Date().toISOString(),
        status: crData.status,
        recommendations: crData.recommendations,
        weighted_sp_change_pct: crData.deltas.weighted_sp_change_pct,
        raw_sp_change_pct: crData.deltas.raw_sp_change_pct,
      },
      { onConflict: 'report_date' }
    )
    .select('id')
    .single()

  if (reportErr || !reportRow) {
    console.error('⚠️ [CR DB] daily_reports upsert:', reportErr?.message)
    return
  }
  const reportId = reportRow.id

  // ── 2. Upsert window metrics (w7, prior_w7, w28) ────────────────────────
  for (const [windowType, metrics] of [
    ['w7', crData.w7],
    ['prior_w7', crData.prior_w7],
    ['w28', crData.w28],
  ] as const) {
    const { error } = await supabase
      .from('pace_cr_window_metrics')
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
          p1: metrics.pass_distribution.p1,
          p2: metrics.pass_distribution.p2,
          p3: metrics.pass_distribution.p3,
          p4plus: metrics.pass_distribution.p4plus,
        },
        { onConflict: 'report_id,window_type' }
      )
    if (error) console.error(`⚠️ [CR DB] window_metrics upsert (${windowType}):`, error.message)
  }

  // ── 3. Owner metrics — delete today's rows then re-insert (w7 + w28) ─────
  await supabase.from('pace_cr_owner_metrics').delete().eq('report_id', reportId)

  const ownerRows = [
    ...crData.owners.map(o => ({ ...o, windowType: 'w7' })),
    ...crData.monthly_owners.map(o => ({ ...o, windowType: 'w28' })),
  ]
  if (ownerRows.length > 0) {
    const { error } = await supabase.from('pace_cr_owner_metrics').insert(
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
      }))
    )
    if (error) console.error('⚠️ [CR DB] owner_metrics insert:', error.message)
  }

  // ── 4. Exclusions — delete today's rows then re-insert ───────────────────
  await supabase.from('pace_cr_exclusions').delete().eq('report_id', reportId)

  if (crData.exclusions.length > 0) {
    const { error } = await supabase.from('pace_cr_exclusions').insert(
      crData.exclusions.map(ex => {
        const last = ex.pushback_history[ex.pushback_history.length - 1]
        return {
          report_id: reportId,
          ticket_key: ex.key,
          cr_pass_count: ex.cr_pass_count,
          last_assignee: last?.assignee ?? null,
          last_status: last?.pushback_activity?.status ?? null,
          pushback_history: ex.pushback_history,
        }
      })
    )
    if (error) console.error('⚠️ [CR DB] exclusions insert:', error.message)
  }

  // ── 5. Insert full snapshot ───────────────────────────────────────────────
  const { error: snapErr } = await supabase
    .from('pace_cr_snapshots')
    .insert({ source: 'sync', data: crData })
  if (snapErr) console.error('⚠️ [CR DB] snapshots insert:', snapErr.message)

  console.log(`✅ [CR DB] Written for ${today}: ${crData.w7.total_tickets} tickets, ${crData.owners.length} owners, ${crData.exclusions.length} exclusions`)
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent CRData snapshot if it is < 23 hours old, otherwise null.
 * The live endpoint calls this before falling back to the Jira API.
 */
export async function readCRFromNormalizedTables(
  supabase: SupabaseClient
): Promise<CRData | null> {
  const { data, error } = await supabase
    .from('pace_cr_snapshots')
    .select('data, synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  const age = Date.now() - new Date(data.synced_at).getTime()
  if (age > SNAPSHOT_MAX_AGE_MS) return null

  return data.data as CRData
}
