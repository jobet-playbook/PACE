import { NextRequest, NextResponse } from 'next/server'
import { createJiraClient } from '@/lib/jira-client'
import { JiraWorkflowProcessor } from '@/lib/jira-workflow'
import { cachePool, CacheKeys } from '@/lib/cache-pool'

/**
 * Cache warming endpoint
 * Populates the cache pool with fresh data from Jira
 * Can be called after daily sync to ensure cache is warm
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔥 [Cache Warm] Starting cache warming...')

    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || process.env.API_SECRET_KEY
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch fresh data from Jira
    const jiraClient = createJiraClient()
    const processor = new JiraWorkflowProcessor(jiraClient)
    const rollbackWindows = await processor.processAllWindows()

    // Build response data
    const response = {
      output: {
        report_meta: {
          generated_at_et: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
          report_type: 'Daily QA Performance Report',
          today_label: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
        },
        people: buildPeopleData(rollbackWindows.w7)
      },
      rollback_windows: rollbackWindows,
      last_30_business_days: {
        total_tickets: rollbackWindows.w28.throughput.total_tickets,
        story_points: rollbackWindows.w28.throughput.total_story_points,
        first_qa_cycle: {
          ticket_count: Math.round(rollbackWindows.w28.throughput.total_tickets * 0.7),
          story_points: Math.round(rollbackWindows.w28.throughput.total_story_points * 0.7)
        },
        returning_qa_cycle: {
          ticket_count: Math.round(rollbackWindows.w28.throughput.total_tickets * 0.3),
          story_points: Math.round(rollbackWindows.w28.throughput.total_story_points * 0.3)
        },
        qa_handlers: rollbackWindows.w28.throughput.per_qa_member_throughput.map((m: any) => ({
          qa_assignee: m.qa_name,
          handled_ticket_count: m.unique_ticket_count,
          handled_ticket_story_points: m.unique_ticket_story_points
        }))
      },
      critical_qa_wip_tickets: rollbackWindows.w7.qa_in_progress.critical_qa_wip_tickets || [],
      old_qa_wip_tickets: rollbackWindows.w7.qa_in_progress.old_qa_wip_tickets || []
    }

    // Warm the cache
    await cachePool.set(CacheKeys.LIVE_METRICS, response)
    
    console.log('✅ [Cache Warm] Cache warmed successfully')

    return NextResponse.json({
      success: true,
      message: 'Cache warmed successfully',
      cacheKey: CacheKeys.LIVE_METRICS
    })

  } catch (error) {
    console.error('❌ [Cache Warm] Error warming cache:', error)
    return NextResponse.json(
      { 
        error: 'Failed to warm cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check cache status
 */
export async function GET() {
  try {
    const stats = cachePool.getStats()
    const liveCache = await cachePool.get(CacheKeys.LIVE_METRICS)
    
    return NextResponse.json({
      cacheStats: stats,
      liveCacheExists: !!liveCache,
      message: liveCache ? 'Cache is warm' : 'Cache is cold'
    })
  } catch (error) {
    console.error('❌ [Cache Warm] Error checking cache:', error)
    return NextResponse.json({ error: 'Failed to check cache' }, { status: 500 })
  }
}

function buildPeopleData(windowData: any) {
  const qaMembers = new Map<string, any>()

  for (const member of windowData.throughput.per_qa_member_throughput) {
    const firstPassTickets = member.tickets.filter((t: any) => !t.had_previous_returns)
    const repeatPassTickets = member.tickets.filter((t: any) => t.had_previous_returns)
    const repeatPercentage = member.unique_ticket_count > 0 
      ? Math.round((repeatPassTickets.length / member.unique_ticket_count) * 100) 
      : 0

    qaMembers.set(member.qa_name, {
      qa_assignee: member.qa_name,
      today_stats: {
        ticket_count: member.unique_ticket_count,
        story_points: member.unique_ticket_story_points,
        first_time_count: firstPassTickets.length,
        repeat_count: repeatPassTickets.length,
        repeat_percentage: repeatPercentage
      },
      today_tickets: member.tickets.map((ticket: any) => {
        const completionTime = ticket.history_created 
          ? new Date(ticket.history_created).toLocaleTimeString('en-US', { 
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }) + ' ET'
          : new Date().toLocaleTimeString('en-US', { 
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            }) + ' ET'

        return {
          ticket_id: ticket.ticket_key,
          completed_time_et: completionTime,
          story_points: ticket.story_points,
          handled_stage: ticket.handled_stage,
          new_stage: 'Done',
          pass_type: ticket.had_previous_returns ? 'repeat_pass' : 'first_time_pass',
          qa_return_cycles_count: ticket.qa_return_cycles_count || 0,
          had_previous_returns: ticket.had_previous_returns || false,
          recap: `${ticket.ticket_key} completed QA (${ticket.story_points || 0} pt${ticket.story_points === 1 ? '' : 's'}, ${ticket.had_previous_returns ? 'repeat' : 'first-time'} pass) moving from ${ticket.handled_stage} to Done.`
        }
      }),
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

function getLastBusinessDay(): Date {
  const date = new Date()
  let daysToSubtract = 1

  if (date.getDay() === 1) {
    daysToSubtract = 3
  } else if (date.getDay() === 0) {
    daysToSubtract = 2
  }

  date.setDate(date.getDate() - daysToSubtract)
  return date
}
