import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createFrontClient } from '@/lib/front-client'
import { processSupport } from '@/lib/support-workflow'
import { writeSupportToDb } from '@/lib/support-metrics-db'
import { cachePool } from '@/lib/cache-pool'

/**
 * POST /api/support-metrics/sync
 *
 * Fetches fresh Support metrics from Front API, writes to normalized
 * pace_support_* tables, then invalidates the memory cache.
 *
 * Called by Vercel cron (see vercel.json) and optionally a manual Refresh button.
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

  try {
    console.log('🔄 [Support Sync] Starting at:', new Date().toISOString())

    const client = createFrontClient()
    // skipEvents=true halves API calls — resolved/archived filter is sufficient for sync
    const data = await processSupport(client, inbox, days, { skipEvents: true })

    const supabase = createClient(supabaseUrl, supabaseKey)
    await writeSupportToDb(supabase, data)

    const cacheKey = `support-metrics:live:${days}:${inbox}`
    await cachePool.clear(cacheKey)
    console.log('✅ [Support Sync] Done. Cache cleared.')

    return NextResponse.json({
      success: true,
      synced_at: new Date().toISOString(),
      stats: {
        total_tickets_resolved: data.total_tickets_resolved,
        agents: data.by_agent.length,
        avg_cycle_time: data.overall.avg_cycle_time,
      },
    })
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
export async function GET(_request: NextRequest) {
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
