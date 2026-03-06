import { NextRequest, NextResponse } from 'next/server'
import { createJiraClient } from '@/lib/jira-client'

/**
 * Test endpoint to verify Jira connection and explore available data
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [Jira Test] Testing Jira connection...')

    const jiraClient = createJiraClient()

    // Test 1: Get any recent tickets from the projects
    console.log('📋 [Jira Test] Fetching recent tickets...')
    const recentTickets = await jiraClient.searchIssues(
      'project in ("Playbook SaaS - Scrum", "PlayBook App") ORDER BY updated DESC',
      []
    )

    console.log(`✅ [Jira Test] Found ${recentTickets.length} recent tickets`)

    // Get unique statuses from recent tickets
    const statuses = new Set<string>()
    const projects = new Set<string>()
    
    recentTickets.slice(0, 50).forEach(ticket => {
      statuses.add(ticket.fields.status.name)
      projects.add(ticket.key.split('-')[0])
    })

    // Test 2: Get tickets in QA-related statuses
    const qaStatuses = ['QA', 'Quality Assurance', 'Testing', 'QA Review', 'Ready for QA']
    const qaTickets = await jiraClient.searchIssues(
      `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status IN ("${qaStatuses.join('", "')}") ORDER BY updated DESC`,
      []
    )

    console.log(`✅ [Jira Test] Found ${qaTickets.length} QA tickets`)

    return NextResponse.json({
      success: true,
      summary: {
        totalRecentTickets: recentTickets.length,
        qaTickets: qaTickets.length,
        uniqueStatuses: Array.from(statuses).sort(),
        uniqueProjects: Array.from(projects).sort()
      },
      sampleTickets: recentTickets.slice(0, 5).map(t => ({
        key: t.key,
        summary: t.fields.summary,
        status: t.fields.status.name,
        assignee: t.fields.assignee?.displayName || 'Unassigned',
        storyPoints: t.fields.customfield_10028 || 0
      })),
      qaTicketsSample: qaTickets.slice(0, 5).map(t => ({
        key: t.key,
        summary: t.fields.summary,
        status: t.fields.status.name,
        assignee: t.fields.assignee?.displayName || 'Unassigned'
      }))
    })

  } catch (error) {
    console.error('❌ [Jira Test] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to test Jira connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
