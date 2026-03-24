import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createJiraClient } from '@/lib/jira-client'
import { DocumentationWorkflowProcessor } from '@/lib/documentation-workflow'
import { writeDocToNormalizedTables } from '@/lib/doc-metrics-db'
import { cachePool } from '@/lib/cache-pool'

const CACHE_KEY = 'documentation-metrics:live'

/**
 * POST /api/documentation-metrics/sync
 *
 * Fetches fresh Documentation metrics from Jira, writes to normalized
 * pace_doc_* tables, then invalidates the memory cache.
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

  const jiraToken = process.env.JIRA_API_TOKEN
  if (!process.env.JIRA_BASE_URL || !process.env.JIRA_EMAIL || !jiraToken || jiraToken.includes('BLANK_VALUE')) {
    return NextResponse.json({ error: 'Jira credentials not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const mode = (searchParams.get('mode') ?? 'full') as 'full' | 'incremental'

    console.log(`🔄 [Doc Sync] Starting ${mode} sync at:`, new Date().toISOString())

    const jiraClient = createJiraClient()
    const processor  = new DocumentationWorkflowProcessor(jiraClient)
    const docData    = await processor.processAll(mode)

    const supabase = createClient(supabaseUrl, supabaseKey)
    await writeDocToNormalizedTables(supabase, docData)

    await cachePool.clear(CACHE_KEY)
    console.log('✅ [Doc Sync] Done. Cache cleared.')

    return NextResponse.json({
      success: true,
      mode,
      synced_at: new Date().toISOString(),
      stats: {
        w7_total_tickets: docData.w7.total_tickets,
        w7_weighted_sp: docData.w7.weighted_story_points,
        owners: docData.owners.length,
        exclusions: docData.exclusions.length,
        wip_total: docData.wip.total_tickets,
        status: docData.status,
      },
    })
  } catch (error) {
    console.error('❌ [Doc Sync] Error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/documentation-metrics/sync
 * Returns the timestamp of the most recent Doc snapshot.
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
      .from('pace_doc_snapshots')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return NextResponse.json({ lastSync: null })
    return NextResponse.json({ lastSync: data.synced_at })
  } catch {
    return NextResponse.json({ error: 'Failed to check sync status' }, { status: 500 })
  }
}
