import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createJiraClient } from '@/lib/jira-client'
import { DocumentationWorkflowProcessor } from '@/lib/documentation-workflow'
import { readDocFromNormalizedTables, writeDocToNormalizedTables } from '@/lib/doc-metrics-db'
import { cachePool } from '@/lib/cache-pool'

const CACHE_KEY = 'documentation-metrics:live'

/**
 * GET /api/documentation-metrics/live
 *
 * 3-layer read:
 *   1. Memory cache (5 min TTL)
 *   2. Supabase pace_doc_snapshots (< 23h old)
 *   3. Live Jira API (fallback — writes to Supabase + warms cache)
 */
export async function GET(_request: NextRequest) {
  try {
    // ── 1. Memory cache ──────────────────────────────────────────────────────
    const cached = await cachePool.get(CACHE_KEY)
    if (cached) {
      return NextResponse.json({ ...cached, _cached: true, _source: 'memory_cache' })
    }

    // ── 2. Supabase ──────────────────────────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const dbData = await readDocFromNormalizedTables(supabase)
      if (dbData) {
        await cachePool.set(CACHE_KEY, dbData)
        return NextResponse.json({ ...dbData, _cached: false, _source: 'supabase' })
      }
    }

    // ── 3. Live Jira API ─────────────────────────────────────────────────────
    const jiraToken = process.env.JIRA_API_TOKEN
    if (!process.env.JIRA_BASE_URL || !process.env.JIRA_EMAIL || !jiraToken || jiraToken.includes('BLANK_VALUE')) {
      return NextResponse.json({ error: 'Jira credentials not configured' }, { status: 500 })
    }

    console.log('📄 [Doc Live] No cached data — fetching from Jira...')
    const jiraClient = createJiraClient()
    const processor  = new DocumentationWorkflowProcessor(jiraClient)
    const data       = await processor.processAll()

    // Persist to Supabase
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      writeDocToNormalizedTables(supabase, data).catch(e =>
        console.error('⚠️ [Doc Live] Supabase write failed:', e)
      )
    }

    await cachePool.set(CACHE_KEY, data)
    return NextResponse.json({ ...data, _cached: false, _source: 'jira_api' })

  } catch (error) {
    console.error('❌ [Doc Live] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isRateLimit = message.includes('429') || message.toLowerCase().includes('rate limit')

    if (isRateLimit) {
      const stale = await cachePool.getStale(CACHE_KEY)
      if (stale) {
        return NextResponse.json({ ...stale, _cached: true, _stale: true, _source: 'stale_cache' })
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch Documentation metrics', details: message },
      { status: 500 }
    )
  }
}
