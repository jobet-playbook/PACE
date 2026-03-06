import { NextRequest, NextResponse } from 'next/server'
import { createJiraClient } from '@/lib/jira-client'
import { JiraWorkflowProcessor } from '@/lib/jira-workflow'

/**
 * API endpoint to sync QA metrics from Jira
 * This replaces the n8n workflow with internal processing
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [QA Metrics Sync] Starting Jira sync at:', new Date().toISOString())

    // Verify authorization (optional - add your auth logic here)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || process.env.API_SECRET_KEY
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Initialize Jira client
    const jiraClient = createJiraClient()
    const processor = new JiraWorkflowProcessor(jiraClient)

    // Process all rollback windows
    console.log('📊 [QA Metrics Sync] Processing rollback windows...')
    const rollback_windows = await processor.processAllWindows()

    // Extract deduplicated critical and old WIP tickets
    const allCritical = new Set<string>()
    const allOld = new Set<string>()
    const critical_qa_wip_tickets: any[] = []
    const old_qa_wip_tickets: any[] = []

    for (const data of Object.values(rollback_windows)) {
      for (const ticket of data.qa_in_progress.critical_qa_wip_tickets) {
        if (!allCritical.has(ticket.ticket_key)) {
          allCritical.add(ticket.ticket_key)
          critical_qa_wip_tickets.push(ticket)
        }
      }

      for (const ticket of data.qa_in_progress.old_qa_wip_tickets) {
        if (!allOld.has(ticket.ticket_key)) {
          allOld.add(ticket.ticket_key)
          old_qa_wip_tickets.push(ticket)
        }
      }
    }

    console.log('✅ [QA Metrics Sync] Processed rollback windows')
    console.log(`  - Critical WIP tickets: ${critical_qa_wip_tickets.length}`)
    console.log(`  - Old WIP tickets: ${old_qa_wip_tickets.length}`)

    // Fetch today's and last business day's completed tickets for daily report
    // This would need additional logic to determine "today" and "last business day"
    // For now, we'll use the w7 window data as a placeholder
    
    // TODO: Implement daily ticket fetching logic
    // const todayTickets = await fetchTodayTickets(jiraClient)
    // const lastBDTickets = await fetchLastBusinessDayTickets(jiraClient)

    // Prepare data for ingestion
    const metricsData = {
      rollback_windows,
      critical_qa_wip_tickets,
      old_qa_wip_tickets,
      // Add more fields as needed for the daily report
      output: {
        report_meta: {
          generated_at_et: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
          report_type: 'Daily QA Performance Report',
          today_label: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
        },
        people: [] // TODO: Build from ticket data
      }
    }

    // Store in old format (pace_qa_metrics table) for backward compatibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error: insertError } = await supabase
      .from('pace_qa_metrics')
      .insert({
        output: metricsData.output,
        rollback_windows: metricsData.rollback_windows,
        critical_wip_tickets: critical_qa_wip_tickets,
        old_qa_wip_tickets: old_qa_wip_tickets,
        last_30_business_days: {} // TODO: Calculate this
      })

    if (insertError) {
      console.error('❌ [QA Metrics Sync] Error storing metrics:', insertError)
      throw insertError
    }

    console.log('✅ [QA Metrics Sync] Metrics stored successfully')

    // Optionally, also send to the v2 normalized endpoint
    // await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/qa-metrics-v2`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(metricsData)
    // })

    return NextResponse.json({
      success: true,
      message: 'QA metrics synced successfully from Jira',
      stats: {
        rollbackWindows: Object.keys(rollback_windows).length,
        criticalWipTickets: critical_qa_wip_tickets.length,
        oldWipTickets: old_qa_wip_tickets.length
      }
    })

  } catch (error) {
    console.error('❌ [QA Metrics Sync] Error syncing QA metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to sync QA metrics from Jira',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('pace_qa_metrics')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({
        lastSync: null,
        message: 'No sync data found'
      })
    }

    return NextResponse.json({
      lastSync: data.created_at,
      message: 'Last sync completed successfully'
    })

  } catch (error) {
    console.error('❌ [QA Metrics Sync] Error checking sync status:', error)
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    )
  }
}

/**
 * Helper: Get last business day
 */
function getLastBusinessDay(): Date {
  const date = new Date()
  let daysToSubtract = 1

  // If today is Monday, go back to Friday
  if (date.getDay() === 1) {
    daysToSubtract = 3
  }
  // If today is Sunday, go back to Friday
  else if (date.getDay() === 0) {
    daysToSubtract = 2
  }

  date.setDate(date.getDate() - daysToSubtract)
  return date
}
