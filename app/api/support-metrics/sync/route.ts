import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createFrontClient } from '@/lib/front-client'
import { processSupport } from '@/lib/support-workflow'
import { writeSupportToDb, getLastSyncedAt, mergeSupportIncremental } from '@/lib/support-metrics-db'
import { cachePool } from '@/lib/cache-pool'

const INCREMENTAL_MAX_AGE_MS = 23 * 60 * 60 * 1000 // 23h — beyond this, do full sync

/**
 * POST /api/support-metrics/sync?mode=full|incremental
 *
 * Incremental (default): only fetch conversations archived since last sync,
 *   merge into existing DB data, recompute agent stats.
 * Full: re-fetch everything (7-day window), replace all DB data.
 *
 * Called by Vercel cron (GET with auth header delegates here).
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
    return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 })
  }

  const frontToken = process.env.FRONT_API_TOKEN
  if (!frontToken) {
    return NextResponse.json({ error: 'Front API credentials not configured' }, { status: 500 })
  }

  const inboxIds = (process.env.FRONT_INBOX_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (inboxIds.length === 0) {
    return NextResponse.json({ error: 'FRONT_INBOX_IDS not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7', 10)
  const inbox = searchParams.get('inbox') ?? inboxIds[0]
  const forceMode = searchParams.get('mode') // 'full' | 'incremental' | null

  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const client = createFrontClient()
    const cacheKey = `support-metrics:live:${days}:${inbox}`

    // Decide: incremental or full
    let useIncremental = forceMode !== 'full'
    let lastSync: Awaited<ReturnType<typeof getLastSyncedAt>> = null

    if (useIncremental) {
      lastSync = await getLastSyncedAt(supabase)
      // Fall back to full if no previous sync or too old
      if (!lastSync || (Date.now() - lastSync.lastSyncedAt.getTime()) > INCREMENTAL_MAX_AGE_MS) {
        useIncremental = false
        console.log('🔄 [Support Sync] No recent sync found — doing full fetch')
      }
    }

    if (useIncremental && lastSync) {
      // ── Incremental sync ─────────────────────────────────────────────────
      const sinceUnix = Math.floor(lastSync.lastSyncedAt.getTime() / 1000)
      console.log(`🔄 [Support Sync] Incremental since ${lastSync.lastSyncedAt.toISOString()}`)

      const data = await processSupport(client, inbox, days, {
        skipEvents: true,
        sinceTimestamp: sinceUnix,
      })

      if (data.issues.length === 0) {
        console.log('✅ [Support Sync] Incremental: no new conversations')
        // Still update last_synced_at
        await supabase
          .from('pace_support_daily_reports')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', lastSync.reportId)
      } else {
        await mergeSupportIncremental(supabase, lastSync.reportId, data.issues)
      }

      await cachePool.clear(cacheKey)
      return NextResponse.json({
        success: true,
        mode: 'incremental',
        synced_at: new Date().toISOString(),
        new_conversations: data.issues.length,
      })
    } else {
      // ── Full sync ────────────────────────────────────────────────────────
      console.log('🔄 [Support Sync] Full fetch starting')
      const data = await processSupport(client, inbox, days, { skipEvents: true })

      await writeSupportToDb(supabase, data)
      await cachePool.clear(cacheKey)

      return NextResponse.json({
        success: true,
        mode: 'full',
        synced_at: new Date().toISOString(),
        stats: {
          total_tickets_resolved: data.total_tickets_resolved,
          agents: data.by_agent.length,
          avg_cycle_time: data.overall.avg_cycle_time,
        },
      })
    }
  } catch (error) {
    console.error('❌ [Support Sync] Error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/support-metrics/sync
 * Returns the timestamp of the most recent support report.
 */
export async function GET(request: NextRequest) {
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
      .from('pace_support_daily_reports')
      .select('generated_at')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return NextResponse.json({ lastSync: null })
    return NextResponse.json({ lastSync: data.generated_at })
  } catch {
    return NextResponse.json({ error: 'Failed to check sync status' }, { status: 500 })
  }
}
