import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createFrontClient } from '@/lib/front-client'
import { processSupport } from '@/lib/support-workflow'
import { readSupportFromDb, writeSupportToDb } from '@/lib/support-metrics-db'
import { cachePool } from '@/lib/cache-pool'

/**
 * GET /api/support-metrics/live?days=7&inbox=<id>
 *
 * 3-layer read:
 *   1. Memory cache (5 min TTL)
 *   2. Supabase pace_support_* tables (< 23h old)
 *   3. Live Front API (fallback — writes to Supabase + warms cache)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7', 10)
  const inboxIds = (process.env.FRONT_INBOX_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const inbox = searchParams.get('inbox') ?? inboxIds[0] ?? ''

  const cacheKey = `support-metrics:live:${days}:${inbox}`

  try {
    // ── 1. Memory cache ──────────────────────────────────────────────────
    const cached = await cachePool.get(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, _cached: true, _source: 'memory_cache' })
    }

    // ── 2. Supabase ──────────────────────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const dbData = await readSupportFromDb(supabase)
      if (dbData) {
        await cachePool.set(cacheKey, dbData)
        return NextResponse.json({ ...dbData, _cached: false, _source: 'supabase' })
      }
    }

    // ── 3. Live Front API ────────────────────────────────────────────────
    const frontToken = process.env.FRONT_API_TOKEN
    if (!frontToken) {
      return NextResponse.json(
        {
          error: 'Front API credentials not configured',
          message: 'Add FRONT_API_TOKEN and FRONT_INBOX_IDS to .env.local',
        },
        { status: 500 }
      )
    }

    if (!inbox) {
      return NextResponse.json(
        { error: 'No inbox ID configured. Set FRONT_INBOX_IDS in .env.local' },
        { status: 400 }
      )
    }

    console.log(`📬 [Support Live] Fetching from Front API (${days}d, inbox: ${inbox})...`)
    const client = createFrontClient()
    // skipEvents=true to avoid rate limits — resolved/archived filter is sufficient
    const data = await processSupport(client, inbox, days, { skipEvents: true })

    // Persist to Supabase
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      writeSupportToDb(supabase, data).catch(e =>
        console.error('⚠️ [Support Live] Supabase write failed:', e)
      )
    }

    await cachePool.set(cacheKey, data)
    return NextResponse.json({ ...data, _cached: false, _source: 'front_api' })

  } catch (error) {
    console.error('❌ [Support Live] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isRateLimit = message.includes('429') || message.toLowerCase().includes('rate limit')

    if (isRateLimit) {
      const stale = await cachePool.getStale(cacheKey)
      if (stale) {
        return NextResponse.json({ ...stale, _cached: true, _stale: true, _source: 'stale_cache' })
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch Support metrics', details: message },
      { status: 500 }
    )
  }
}
