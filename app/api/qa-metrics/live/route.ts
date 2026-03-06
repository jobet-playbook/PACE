import { NextRequest, NextResponse } from 'next/server'
import { createJiraClient } from '@/lib/jira-client'
import { JiraWorkflowProcessor } from '@/lib/jira-workflow'

/**
 * API endpoint to fetch and process live QA metrics from Jira
 * Returns processed data ready for UI consumption
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [QA Metrics Live] Fetching live data from Jira at:', new Date().toISOString())

    // Check if Jira credentials are configured
    const jiraBaseUrl = process.env.JIRA_BASE_URL
    const jiraEmail = process.env.JIRA_EMAIL
    const jiraToken = process.env.JIRA_API_TOKEN

    if (!jiraBaseUrl || !jiraEmail || !jiraToken || jiraToken.includes('BLANK_VALUE')) {
      console.error('❌ [QA Metrics Live] Jira credentials not configured')
      return NextResponse.json(
        { 
          error: 'Jira credentials not configured',
          message: 'Please add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to your .env.local file',
          instructions: 'Get your API token from: https://id.atlassian.com/manage-profile/security/api-tokens'
        },
        { status: 500 }
      )
    }

    // Initialize Jira client
    const jiraClient = createJiraClient()
    const processor = new JiraWorkflowProcessor(jiraClient)

    // Process all rollback windows
    console.log('📊 [QA Metrics Live] Processing rollback windows...')
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

    console.log('✅ [QA Metrics Live] Processed rollback windows')
    console.log(`  - Critical WIP tickets: ${critical_qa_wip_tickets.length}`)
    console.log(`  - Old WIP tickets: ${old_qa_wip_tickets.length}`)

    // Calculate last 30 business days summary from w28 data
    const w28Data = rollback_windows.w28
    const last_30_business_days = {
      total_tickets: w28Data.throughput.total_tickets,
      story_points: w28Data.throughput.total_story_points,
      first_qa_cycle: {
        ticket_count: Math.round(w28Data.throughput.total_tickets * 0.7), // Estimate
        story_points: Math.round(w28Data.throughput.total_story_points * 0.7)
      },
      returning_qa_cycle: {
        ticket_count: Math.round(w28Data.throughput.total_tickets * 0.3),
        story_points: Math.round(w28Data.throughput.total_story_points * 0.3)
      },
      qa_handlers: w28Data.throughput.per_qa_member_throughput.map(member => ({
        qa_assignee: member.qa_name,
        handled_ticket_count: member.unique_ticket_count,
        handled_ticket_story_points: member.unique_ticket_story_points
      }))
    }

    // Build response in the format expected by the UI
    const response = {
      output: {
        report_meta: {
          generated_at_et: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
          report_type: 'Daily QA Performance Report',
          today_label: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
        },
        people: buildPeopleData(rollback_windows.w7)
      },
      rollback_windows,
      last_30_business_days,
      critical_qa_wip_tickets,
      old_qa_wip_tickets
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [QA Metrics Live] Error fetching live data:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch live QA metrics from Jira',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Build people data from rollback window
 */
function buildPeopleData(windowData: any) {
  const people: any[] = []
  const qaMembers = new Map<string, any>()

  // Aggregate data by QA member
  for (const member of windowData.throughput.per_qa_member_throughput) {
    if (!qaMembers.has(member.qa_name)) {
      qaMembers.set(member.qa_name, {
        qa_assignee: member.qa_name,
        today_stats: {
          ticket_count: member.unique_ticket_count,
          story_points: member.unique_ticket_story_points,
          first_time_count: Math.round(member.unique_ticket_count * 0.7), // Estimate
          repeat_count: Math.round(member.unique_ticket_count * 0.3),
          repeat_percentage: 30 // Estimate
        },
        today_tickets: member.tickets.map((ticket: any) => ({
          ticket_id: ticket.ticket_key,
          completed_time_et: '12:00 PM ET', // Placeholder
          story_points: ticket.story_points,
          handled_stage: ticket.handled_stage,
          new_stage: 'Done',
          pass_type: 'first_time_pass',
          qa_return_cycles_count: 0,
          had_previous_returns: false,
          recap: `Completed ${ticket.ticket_key}`
        })),
        last_business_day_stats: {
          ticket_count: 0,
          story_points: 0,
          first_time_count: 0,
          repeat_count: 0,
          repeat_percentage: 0
        },
        last_business_day_tickets: []
      })
    }
  }

  // Add WIP data
  for (const member of windowData.qa_in_progress.per_qa_member_qa_in_progress) {
    if (!qaMembers.has(member.qa_assignee)) {
      qaMembers.set(member.qa_assignee, {
        qa_assignee: member.qa_assignee,
        today_stats: {
          ticket_count: 0,
          story_points: 0,
          first_time_count: 0,
          repeat_count: 0,
          repeat_percentage: 0
        },
        today_tickets: [],
        last_business_day_stats: {
          ticket_count: 0,
          story_points: 0,
          first_time_count: 0,
          repeat_count: 0,
          repeat_percentage: 0
        },
        last_business_day_tickets: []
      })
    }

    const memberData = qaMembers.get(member.qa_assignee)
    memberData.wip_count = member.qa_tickets_wip_count
    memberData.wip_story_points = member.qa_tickets_wip_story_points_total
  }

  return Array.from(qaMembers.values())
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
