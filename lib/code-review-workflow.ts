/**
 * Code Review Workflow Processor
 * Mirrors QA workflow structure but tracks Code Review metrics
 */

import { JiraClient } from './jira-client'

// Code Review status
const CODE_REVIEW_STATUS = ['Code Review']

// Rollback windows configuration
const ROLLBACK_WINDOWS = [
  { key: 'w7', title: 'Last 7 Business Days', days: 7, prior_days: 0 },
  { key: 'w28', title: 'Last 28 Business Days', days: 28, prior_days: 0 },
  { key: 'prior_w7', title: 'Prior 7 Business Days', days: 7, prior_days: 7 },
  { key: 'prior_w28', title: 'Prior 28 Business Days', days: 28, prior_days: 28 }
]

interface RollbackWindow {
  key: string
  title: string
  days: number
  prior_days: number
}

export interface CodeReviewMetrics {
  rollback_window_description: string
  cycle_time: {
    to_code_review_avg_bd: number  // CR-Cycle: Time to reach Code Review
    to_ready_for_dev_avg_bd: number  // T-Cycle: Time to Ready for Dev
    to_pushback_avg_bd: number  // R-Age: CR Pushback time
  }
  throughput: {
    total_story_points: number
    total_tickets: number
    pace_sp_per_bd: number
    per_reviewer_throughput: Array<{
      reviewer_name: string
      unique_ticket_count: number
      unique_ticket_story_points: number
      tickets: Array<{
        ticket_key: string
        story_points: number
        history_created?: string
        had_previous_returns: boolean
        cr_return_cycles_count: number
      }>
    }>
  }
  code_review_in_progress: {
    total_tickets: number
    total_story_points: number
    per_reviewer_cr_in_progress: Array<{
      reviewer_assignee: string
      cr_tickets_wip_count: number
      cr_tickets_wip_story_points_total: number
    }>
  }
  quality_issues: {
    critical_blockers_count: number
    critical_blockers: {
      total_count: number
      unresolved_count: number
      resolved_count: number
      old_unresolved: Array<{
        key: string
        summary: string
        status: string
        priority: string
        age_bd: number
      }>
    }
  }
}

export class CodeReviewWorkflowProcessor {
  constructor(private jiraClient: JiraClient) {}

  /**
   * Process a single rollback window for Code Review
   */
  async processRollbackWindow(window: RollbackWindow): Promise<CodeReviewMetrics> {
    console.log(`📊 [CR] Processing rollback window: ${window.title}`)

    const startDay = -(window.days + window.prior_days)
    const endDay = -window.prior_days
    const crStatusList = CODE_REVIEW_STATUS.map(s => `"${s}"`).join(', ')
    const finalStatusList = '"Ready for Dev", "In Progress", "Done"'
    const pushbackStatusList = '"In Progress", "Open"'

    // Fetch tickets using n8n-style structure (3 queries)
    const [finalStatusTickets, pushbackTickets, trackedStatusTickets] = await Promise.all([
      // 1. Final Status - tickets that completed Code Review (moved to Ready for Dev, In Progress, or Done)
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED TO (${finalStatusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
        ['changelog']
      ),
      
      // 2. Pushback - tickets that moved FROM final status back TO In Progress/Open
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED FROM (${finalStatusList}) TO (${pushbackStatusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
        ['changelog']
      ),
      
      // 3. Tracked Status - tickets currently IN Code Review
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED TO (${crStatusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) AND status IN (${crStatusList}) ORDER BY updated DESC`,
        ['changelog']
      )
    ])

    console.log(`  ✓ [CR] Final Status: ${finalStatusTickets.length}, Pushback: ${pushbackTickets.length}, Tracked Status (WIP): ${trackedStatusTickets.length}`)

    // Calculate metrics
    const throughput = this.calculateThroughput(finalStatusTickets, window.days)
    const code_review_in_progress = this.calculateWIP(trackedStatusTickets)
    const cycle_time = this.calculateCycleTime(trackedStatusTickets, finalStatusTickets, pushbackTickets)
    const quality_issues = this.calculateQualityIssues(pushbackTickets)

    return {
      rollback_window_description: window.title,
      cycle_time,
      throughput,
      code_review_in_progress,
      quality_issues
    }
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughput(tickets: any[], windowDays: number) {
    const reviewerMap = new Map<string, any>()
    let totalSP = 0
    let totalTickets = 0

    for (const ticket of tickets) {
      const sp = ticket.fields.customfield_10028 || 0
      const reviewer = ticket.fields.assignee?.displayName || 'Unassigned'
      
      // Find when ticket left Code Review
      const crExitHistory = ticket.changelog?.histories?.find((h: any) =>
        h.items.some((item: any) =>
          item.field === 'status' &&
          CODE_REVIEW_STATUS.includes(item.fromString)
        )
      )

      // Count how many times ticket returned to Code Review
      const crReturnCount = ticket.changelog?.histories?.filter((h: any) =>
        h.items.some((item: any) =>
          item.field === 'status' &&
          CODE_REVIEW_STATUS.includes(item.toString)
        )
      ).length || 0

      const hadPreviousReturns = crReturnCount > 1

      if (!reviewerMap.has(reviewer)) {
        reviewerMap.set(reviewer, {
          reviewer_name: reviewer,
          unique_ticket_count: 0,
          unique_ticket_story_points: 0,
          tickets: []
        })
      }

      const reviewerData = reviewerMap.get(reviewer)
      reviewerData.unique_ticket_count++
      reviewerData.unique_ticket_story_points += sp
      reviewerData.tickets.push({
        ticket_key: ticket.key,
        story_points: sp,
        history_created: crExitHistory?.created || ticket.fields.statuscategorychangedate,
        had_previous_returns: hadPreviousReturns,
        cr_return_cycles_count: crReturnCount
      })

      totalSP += sp
      totalTickets++
    }

    return {
      total_story_points: totalSP,
      total_tickets: totalTickets,
      pace_sp_per_bd: windowDays > 0 ? Number((totalSP / windowDays).toFixed(1)) : 0,
      per_reviewer_throughput: Array.from(reviewerMap.values())
    }
  }

  /**
   * Calculate WIP metrics
   */
  private calculateWIP(tickets: any[]) {
    const reviewerMap = new Map<string, any>()
    let totalSP = 0
    let totalTickets = tickets.length

    for (const ticket of tickets) {
      const sp = ticket.fields.customfield_10028 || 0
      const reviewer = ticket.fields.assignee?.displayName || 'Unassigned'

      if (!reviewerMap.has(reviewer)) {
        reviewerMap.set(reviewer, {
          reviewer_assignee: reviewer,
          cr_tickets_wip_count: 0,
          cr_tickets_wip_story_points_total: 0
        })
      }

      const reviewerData = reviewerMap.get(reviewer)
      reviewerData.cr_tickets_wip_count++
      reviewerData.cr_tickets_wip_story_points_total += sp

      totalSP += sp
    }

    return {
      total_tickets: totalTickets,
      total_story_points: totalSP,
      per_reviewer_cr_in_progress: Array.from(reviewerMap.values())
    }
  }

  /**
   * Calculate cycle time metrics
   */
  private calculateCycleTime(wipTickets: any[], doneTickets: any[], pushbackTickets: any[]) {
    let toCodeReviewTotal = 0
    let toCodeReviewCount = 0
    let toReadyForDevTotal = 0
    let toReadyForDevCount = 0
    let toPushbackTotal = 0
    let toPushbackCount = 0

    // Calculate time to Code Review from WIP tickets
    for (const ticket of wipTickets) {
      const crEntry = ticket.changelog?.histories?.find((h: any) =>
        h.items.some((item: any) =>
          item.field === 'status' &&
          CODE_REVIEW_STATUS.includes(item.toString)
        )
      )
      
      if (crEntry) {
        const created = new Date(ticket.fields.created)
        const crDate = new Date(crEntry.created)
        const daysDiff = Math.ceil((crDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        toCodeReviewTotal += daysDiff
        toCodeReviewCount++
      }
    }

    // Calculate time to Ready for Dev from done tickets
    for (const ticket of doneTickets) {
      const created = new Date(ticket.fields.created)
      const doneDate = new Date(ticket.fields.statuscategorychangedate || ticket.fields.updated)
      const daysDiff = Math.ceil((doneDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      toReadyForDevTotal += daysDiff
      toReadyForDevCount++
    }

    // Calculate pushback cycle time
    for (const ticket of pushbackTickets) {
      const pushbackHistory = ticket.changelog?.histories?.find((h: any) =>
        h.items.some((item: any) =>
          item.field === 'status' &&
          item.toString === 'In Progress'
        )
      )
      
      if (pushbackHistory) {
        const created = new Date(ticket.fields.created)
        const pushbackDate = new Date(pushbackHistory.created)
        const daysDiff = Math.ceil((pushbackDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        toPushbackTotal += daysDiff
        toPushbackCount++
      }
    }

    return {
      to_code_review_avg_bd: toCodeReviewCount > 0 ? Number((toCodeReviewTotal / toCodeReviewCount).toFixed(1)) : 0,
      to_ready_for_dev_avg_bd: toReadyForDevCount > 0 ? Number((toReadyForDevTotal / toReadyForDevCount).toFixed(1)) : 0,
      to_pushback_avg_bd: toPushbackCount > 0 ? Number((toPushbackTotal / toPushbackCount).toFixed(1)) : 0
    }
  }

  /**
   * Calculate quality issues (critical blockers)
   */
  private calculateQualityIssues(pushbackTickets: any[]) {
    const criticalBlockers = pushbackTickets.filter(t => 
      t.fields.priority?.name === 'Highest' || t.fields.priority?.name === 'High'
    )

    const unresolved = criticalBlockers.filter(t => t.fields.status.name !== 'Done')
    const resolved = criticalBlockers.filter(t => t.fields.status.name === 'Done')

    return {
      critical_blockers_count: pushbackTickets.length,
      critical_blockers: {
        total_count: criticalBlockers.length,
        unresolved_count: unresolved.length,
        resolved_count: resolved.length,
        old_unresolved: unresolved.map(t => ({
          key: t.key,
          summary: t.fields.summary,
          status: t.fields.status.name,
          priority: t.fields.priority?.name || 'None',
          age_bd: Math.ceil((Date.now() - new Date(t.fields.created).getTime()) / (1000 * 60 * 60 * 24))
        }))
      }
    }
  }

  /**
   * Process all rollback windows
   */
  async processAllWindows(): Promise<Record<string, CodeReviewMetrics>> {
    const results: Record<string, CodeReviewMetrics> = {}

    for (const window of ROLLBACK_WINDOWS) {
      results[window.key] = await this.processRollbackWindow(window)
    }

    return results
  }
}
