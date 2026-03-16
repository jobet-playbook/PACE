import { NextRequest, NextResponse } from 'next/server'
import { createJiraClient } from '@/lib/jira-client'
import { CodeReviewWorkflowProcessor } from '@/lib/code-review-workflow'
import { cachePool, CacheKeys } from '@/lib/cache-pool'

/**
 * API endpoint to fetch and process live Code Review metrics from Jira
 * Uses multi-layer cache pool to combat rate limiting and improve performance
 */
export async function GET(request: NextRequest) {
  const cacheKey = 'code-review-metrics:live'
  
  try {
    console.log('🔄 [CR Live] Fetching Code Review metrics...')

    // 1. Try to get from cache pool (memory + Supabase)
    const cachedData = await cachePool.get(cacheKey)
    if (cachedData) {
      return NextResponse.json({
        ...cachedData,
        _cached: true,
        _source: 'cache_pool'
      })
    }

    console.log('📊 [CR Live] Cache miss, fetching from Jira...')

    // Check if Jira credentials are configured
    const jiraBaseUrl = process.env.JIRA_BASE_URL
    const jiraEmail = process.env.JIRA_EMAIL
    const jiraToken = process.env.JIRA_API_TOKEN

    if (!jiraBaseUrl || !jiraEmail || !jiraToken || jiraToken.includes('BLANK_VALUE')) {
      console.error('❌ [CR Live] Jira credentials not configured')
      return NextResponse.json(
        { 
          error: 'Jira credentials not configured',
          message: 'Please configure JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in your environment variables'
        },
        { status: 500 }
      )
    }

    // Initialize processor
    const jiraClient = createJiraClient()
    const processor = new CodeReviewWorkflowProcessor(jiraClient)

    // Process all rollback windows
    console.log('📊 [CR Live] Processing rollback windows...')
    const rollback_windows = await processor.processAllWindows()

    // Build response
    const response = {
      output: {
        report_meta: {
          generated_at_et: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
          report_type: 'Daily Code Review Performance Report',
          today_label: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
          last_business_day_label: getLastBusinessDay().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
        },
        people: buildPeopleData(rollback_windows.w7)
      },
      rollback_windows,
      last_30_business_days: {
        total_tickets: rollback_windows.w28.throughput.total_tickets,
        story_points: rollback_windows.w28.throughput.total_story_points,
        first_pass: {
          ticket_count: rollback_windows.w28.throughput.per_reviewer_throughput.reduce((sum, r) => 
            sum + r.tickets.filter(t => !t.had_previous_returns).length, 0
          ),
          story_points: rollback_windows.w28.throughput.per_reviewer_throughput.reduce((sum, r) => 
            sum + r.tickets.filter(t => !t.had_previous_returns).reduce((s, t) => s + t.story_points, 0), 0
          )
        },
        repeat_pass: {
          ticket_count: rollback_windows.w28.throughput.per_reviewer_throughput.reduce((sum, r) => 
            sum + r.tickets.filter(t => t.had_previous_returns).length, 0
          ),
          story_points: rollback_windows.w28.throughput.per_reviewer_throughput.reduce((sum, r) => 
            sum + r.tickets.filter(t => t.had_previous_returns).reduce((s, t) => s + t.story_points, 0), 0
          )
        },
        reviewers: rollback_windows.w28.throughput.per_reviewer_throughput.map((r: any) => ({
          reviewer_name: r.reviewer_name,
          handled_ticket_count: r.unique_ticket_count,
          handled_ticket_story_points: r.unique_ticket_story_points
        }))
      },
      critical_blockers: rollback_windows.w7.quality_issues.critical_blockers.old_unresolved || []
    }

    // 2. Store in cache pool for future requests
    await cachePool.set(cacheKey, response)
    console.log('💾 [CR Live] Data cached successfully')

    return NextResponse.json({
      ...response,
      _cached: false,
      _source: 'jira_api'
    })

  } catch (error) {
    console.error('❌ [CR Live] Error fetching live data:', error)
    
    // 3. On error, try to return stale cache (up to 24 hours old)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isRateLimitError = errorMessage.includes('429') || errorMessage.includes('rate limit')
    
    if (isRateLimitError) {
      console.log('⚠️ [CR Live] Rate limit detected, attempting stale cache fallback...')
      const staleData = await cachePool.getStale(cacheKey)
      
      if (staleData) {
        return NextResponse.json({
          ...staleData,
          _cached: true,
          _stale: true,
          _rateLimited: true,
          _source: 'stale_cache'
        })
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch live Code Review metrics from Jira',
        details: errorMessage,
        suggestion: 'Please try again in a few minutes or contact support if the issue persists'
      },
      { status: 500 }
    )
  }
}

/**
 * Build people data from rollback window
 */
function buildPeopleData(windowData: any) {
  const reviewers = new Map<string, any>()

  for (const reviewer of windowData.throughput.per_reviewer_throughput) {
    const firstPassTickets = reviewer.tickets.filter((t: any) => !t.had_previous_returns)
    const repeatPassTickets = reviewer.tickets.filter((t: any) => t.had_previous_returns)
    const repeatPercentage = reviewer.unique_ticket_count > 0 
      ? Math.round((repeatPassTickets.length / reviewer.unique_ticket_count) * 100) 
      : 0

    reviewers.set(reviewer.reviewer_name, {
      reviewer_name: reviewer.reviewer_name,
      today_stats: {
        ticket_count: reviewer.unique_ticket_count,
        story_points: reviewer.unique_ticket_story_points,
        first_time_count: firstPassTickets.length,
        repeat_count: repeatPassTickets.length,
        repeat_percentage: repeatPercentage
      },
      today_tickets: reviewer.tickets.map((ticket: any) => {
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
          pass_type: ticket.had_previous_returns ? 'repeat_pass' : 'first_time_pass',
          cr_return_cycles_count: ticket.cr_return_cycles_count || 0,
          had_previous_returns: ticket.had_previous_returns || false,
          recap: `${ticket.ticket_key} completed Code Review (${ticket.story_points || 0} pt${ticket.story_points === 1 ? '' : 's'}, ${ticket.had_previous_returns ? 'repeat' : 'first-time'} pass).`
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

  // Add reviewers with WIP but no completions
  for (const reviewer of windowData.code_review_in_progress.per_reviewer_cr_in_progress) {
    if (!reviewers.has(reviewer.reviewer_assignee)) {
      reviewers.set(reviewer.reviewer_assignee, {
        reviewer_name: reviewer.reviewer_assignee,
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

    const reviewerData = reviewers.get(reviewer.reviewer_assignee)
    reviewerData.wip_count = reviewer.cr_tickets_wip_count
    reviewerData.wip_story_points = reviewer.cr_tickets_wip_story_points_total
  }

  return Array.from(reviewers.values())
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
