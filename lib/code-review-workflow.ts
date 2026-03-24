/**
 * Code Review Workflow Processor — mirrors n8n workflow logic
 *
 * Tracks tickets that enter "Code Review", counts pushbacks (re-entries),
 * and computes per-developer (creator) weighted SP output.
 *
 * final_status    = ["Code Review"]   — the bottleneck stage being measured
 * pushback_status = ["In Progress"]  — where tickets go when pushed back
 */

import { JiraClient } from './jira-client'

const FINAL_STATUS    = ['Code Review']
const PUSHBACK_STATUS = ['In Progress']
// T-Cycle end = first exit from Code Review that is NOT a pushback
// (i.e. Ready for Dev, Done, QA, Push Staging — whatever comes next in the workflow)
const PROJECTS = '"Playbook SaaS - Scrum", "PlayBook App"'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CRFinalTicket {
  key: string
  creator: string
  tracked_pass_count: number   // 1 = first-pass, 2+ = had pushbacks
  story_points: number | null
  cr_cycle_days: number | null  // days from ticket creation → first CR entry
  t_cycle_days: number | null   // days from first CR entry → Ready for Dev
}

export interface CRPushbackEntry {
  assignee: string
  cr_pass_number: number
  cr_activity: { stage: string; timestamp: string } | null
  pushback_activity: { status: string; timestamp: string }
}

export interface CRPushbackTicket {
  key: string
  cr_pass_count: number
  pushback_history: CRPushbackEntry[]
}

export interface CROwnerTicket {
  key: string
  story_points: number | null
  tracked_pass_count: number
}

export interface CROwner {
  owner: string
  ticket_count: number
  ticket_keys: string
  tickets: CROwnerTicket[]
  raw_sp: number
  weighted_sp: number
  missing_sp: number
  first_pass_count: number
  repeat_pass_count: number
  first_pass_sp: number
  repeat_pass_sp: number
}

export interface CRWindowMetrics {
  total_tickets: number
  raw_story_points: number
  weighted_story_points: number
  missing_story_points: number
  first_pass_sp: number
  repeat_pass_sp: number
  quality_issues: number        // tickets requiring 3+ passes
  cr_cycle_avg_days: number     // avg days from creation → first CR entry
  t_cycle_avg_days: number      // avg days from first CR entry → Ready for Dev
  pass_distribution: { p1: number; p2: number; p3: number; p4plus: number }
}

export interface CRCycleTimes {
  r_age_cycle_w7: number    // avg calendar days in CR before pushback (last 7d pushbacks)
  r_age_cycle_w28: number   // avg calendar days in CR before pushback (last 28d pushbacks)
}

export interface CRData {
  w7: CRWindowMetrics
  prior_w7: CRWindowMetrics
  w28: CRWindowMetrics
  owners: CROwner[]              // per-developer, from w7 final tickets
  prior_w7_owners: CROwner[]     // per-developer, from prior_w7 final tickets
  monthly_owners: CROwner[]      // per-developer, from w28 final tickets
  exclusions: CRPushbackTicket[] // tickets with pushbacks, from w28
  cycle_times: CRCycleTimes
  status: 'GREEN' | 'YELLOW' | 'RED'
  recommendations: string[]
  deltas: { weighted_sp_change_pct: number; raw_sp_change_pct: number }
  report_date: string
}

// ── Processor ─────────────────────────────────────────────────────────────────

export class CodeReviewWorkflowProcessor {
  constructor(private jiraClient: JiraClient) {}

  /**
   * Fetch tickets that entered Code Review in the given window,
   * counting how many CR passes each ticket required.
   */
  private async fetchFinalTickets(days: number, priorDays: number): Promise<CRFinalTicket[]> {
    const startDay = -(days + priorDays)
    const endDay = -priorDays
    const finalList = FINAL_STATUS.map(s => `"${s}"`).join(', ')

    const tickets = await this.jiraClient.searchIssues(
      `project in (${PROJECTS}) AND status CHANGED TO (${finalList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
      ['changelog'],
      { fields: 'customfield_10028,created,status,creator,summary' }
    )

    const finalSet    = new Set(FINAL_STATUS)
    const pushbackSet = new Set(PUSHBACK_STATUS)
    const MS_PER_DAY = 1000 * 60 * 60 * 24

    return tickets.map((ticket: any) => {
      let trackedPassCount = 1
      let firstCRTimestamp: number | null = null
      let readyForDevTimestamp: number | null = null

      const createdMs = ticket.fields?.created
        ? new Date(ticket.fields.created).getTime()
        : null

      const histories = [...(ticket.changelog?.histories ?? [])].sort(
        (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime()
      )

      for (const history of histories) {
        const historyMs = new Date(history.created).getTime()
        for (const item of [...(history.items ?? [])].reverse()) {
          if (item.field !== 'status') continue

          // First time entering Code Review
          if (finalSet.has(item.toString) && firstCRTimestamp === null) {
            firstCRTimestamp = historyMs
          }

          // CR → In Progress = pushback
          if (finalSet.has(item.fromString) && pushbackSet.has(item.toString)) {
            trackedPassCount++
          }

          // CR → any forward status (not a pushback) = T-Cycle end
          // Captures: Ready for Dev, Done, QA, Push Staging, etc.
          if (finalSet.has(item.fromString) && !pushbackSet.has(item.toString)) {
            if (readyForDevTimestamp === null) readyForDevTimestamp = historyMs
          }
        }
      }

      const crCycleDays = (createdMs !== null && firstCRTimestamp !== null)
        ? parseFloat(((firstCRTimestamp - createdMs) / MS_PER_DAY).toFixed(1))
        : null

      const tCycleDays = (firstCRTimestamp !== null && readyForDevTimestamp !== null)
        ? parseFloat(((readyForDevTimestamp - firstCRTimestamp) / MS_PER_DAY).toFixed(1))
        : null

      const spRaw = ticket.fields?.customfield_10028
      return {
        key: ticket.key,
        creator: ticket.fields?.creator?.displayName ?? 'Unknown',
        tracked_pass_count: trackedPassCount,
        story_points: typeof spRaw === 'number' ? spRaw : null,
        cr_cycle_days: crCycleDays,
        t_cycle_days: tCycleDays,
      }
    })
  }

  /**
   * Fetch tickets that were pushed back from Code Review to In Progress
   * in the given window, building a full pushback history per ticket.
   */
  private async fetchPushbackTickets(days: number, priorDays: number): Promise<CRPushbackTicket[]> {
    const startDay = -(days + priorDays)
    const endDay = -priorDays
    const finalList = FINAL_STATUS.map(s => `"${s}"`).join(', ')
    const pushbackList = PUSHBACK_STATUS.map(s => `"${s}"`).join(', ')

    const tickets = await this.jiraClient.searchIssues(
      `project in (${PROJECTS}) AND status CHANGED FROM (${finalList}) TO (${pushbackList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
      ['changelog']
    )

    const finalSet = new Set(FINAL_STATUS)
    const pushbackSet = new Set(PUSHBACK_STATUS)

    return tickets.map((ticket: any) => {
      const pushbackHistory: CRPushbackEntry[] = []
      let crPassCount = 1
      let currentCRActivity: { stage: string; timestamp: string } | null = null

      const histories = [...(ticket.changelog?.histories ?? [])].sort(
        (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime()
      )

      for (const history of histories) {
        for (const item of [...(history.items ?? [])].reverse()) {
          if (item.field !== 'status') continue

          // Track last time ticket entered CR
          if (finalSet.has(item.toString)) {
            if (!currentCRActivity || new Date(history.created) > new Date(currentCRActivity.timestamp)) {
              currentCRActivity = { stage: item.toString, timestamp: history.created }
            }
          }

          // CR → In Progress = pushback event
          if (finalSet.has(item.fromString) && pushbackSet.has(item.toString)) {
            pushbackHistory.push({
              assignee: history.author?.displayName ?? 'Unknown',
              cr_pass_number: crPassCount,
              cr_activity: currentCRActivity,
              pushback_activity: { status: item.toString, timestamp: history.created },
            })
            currentCRActivity = null
            crPassCount++
          }
        }
      }

      return { key: ticket.key, cr_pass_count: crPassCount, pushback_history: pushbackHistory }
    })
  }

  private computeWindowMetrics(tickets: CRFinalTicket[]): CRWindowMetrics {
    let weightedSP = 0, rawSP = 0, missingSP = 0
    let firstPassSP = 0, repeatPassSP = 0
    const passes = { p1: 0, p2: 0, p3: 0, p4plus: 0 }
    const crCycleSamples: number[] = []
    const tCycleSamples: number[] = []

    for (const t of tickets) {
      const attempts = t.tracked_pass_count || 1
      if (attempts === 1) passes.p1++
      else if (attempts === 2) passes.p2++
      else if (attempts === 3) passes.p3++
      else passes.p4plus++

      if (t.story_points === null || t.story_points === undefined) {
        missingSP++
      } else {
        rawSP += t.story_points
        if (attempts === 1) {
          weightedSP += t.story_points * 1.0
          firstPassSP += t.story_points
        } else {
          if (attempts === 2) weightedSP += t.story_points * 0.33
          else if (attempts === 3) weightedSP += t.story_points * 0.25
          repeatPassSP += t.story_points
        }
      }

      if (t.cr_cycle_days !== null && t.cr_cycle_days >= 0) crCycleSamples.push(t.cr_cycle_days)
      if (t.t_cycle_days  !== null && t.t_cycle_days  >= 0) tCycleSamples.push(t.t_cycle_days)
    }

    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1))

    return {
      total_tickets: tickets.length,
      raw_story_points: rawSP,
      weighted_story_points: parseFloat(weightedSP.toFixed(2)),
      missing_story_points: missingSP,
      first_pass_sp: firstPassSP,
      repeat_pass_sp: repeatPassSP,
      quality_issues: passes.p3 + passes.p4plus,
      cr_cycle_avg_days: avg(crCycleSamples),
      t_cycle_avg_days: avg(tCycleSamples),
      pass_distribution: passes,
    }
  }

  private computeOwners(tickets: CRFinalTicket[]): CROwner[] {
    const ownerMap = new Map<string, CRFinalTicket[]>()
    for (const t of tickets) {
      if (!ownerMap.has(t.creator)) ownerMap.set(t.creator, [])
      ownerMap.get(t.creator)!.push(t)
    }

    const owners: CROwner[] = []
    for (const [owner, ownerTickets] of ownerMap) {
      let rawSP = 0, weightedSP = 0, missingSP = 0
      let firstPassCount = 0, repeatPassCount = 0
      const keys: string[] = []
      const tickets: CROwnerTicket[] = []

        let firstPassSP = 0, repeatPassSP = 0

      for (const t of ownerTickets) {
        keys.push(t.key)
        tickets.push({ key: t.key, story_points: t.story_points, tracked_pass_count: t.tracked_pass_count })
        const attempts = t.tracked_pass_count || 1
        if (attempts === 1) firstPassCount++
        else repeatPassCount++

        if (t.story_points === null || t.story_points === undefined) {
          missingSP++
        } else {
          rawSP += t.story_points
          if (attempts === 1) {
            weightedSP += t.story_points * 1.0
            firstPassSP += t.story_points
          } else {
            if (attempts === 2) weightedSP += t.story_points * 0.33
            else if (attempts === 3) weightedSP += t.story_points * 0.25
            repeatPassSP += t.story_points
          }
        }
      }

      owners.push({
        owner,
        ticket_count: ownerTickets.length,
        ticket_keys: keys.join(', '),
        tickets,
        raw_sp: rawSP,
        weighted_sp: parseFloat(weightedSP.toFixed(2)),
        missing_sp: missingSP,
        first_pass_count: firstPassCount,
        repeat_pass_count: repeatPassCount,
        first_pass_sp: firstPassSP,
        repeat_pass_sp: repeatPassSP,
      })
    }

    return owners.sort((a, b) => b.weighted_sp - a.weighted_sp)
  }

  /**
   * Compute average cycle time (calendar days) that tickets spent in Code Review
   * before being pushed back. Uses pushback history timestamps.
   */
  private computeRAgeCycle(exclusions: CRPushbackTicket[]): number {
    const durations: number[] = []
    for (const ex of exclusions) {
      for (const entry of ex.pushback_history) {
        if (entry.cr_activity?.timestamp && entry.pushback_activity?.timestamp) {
          const crEntry  = new Date(entry.cr_activity.timestamp).getTime()
          const pushback = new Date(entry.pushback_activity.timestamp).getTime()
          const days = (pushback - crEntry) / (1000 * 60 * 60 * 24)
          if (days >= 0) durations.push(days)
        }
      }
    }
    if (durations.length === 0) return 0
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length
    return parseFloat(avg.toFixed(1))
  }

  private computeStatus(w7: CRWindowMetrics, priorW7: CRWindowMetrics): { status: 'GREEN' | 'YELLOW' | 'RED'; recommendations: string[] } {
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN'
    const recommendations: string[] = []
    const { pass_distribution: p, total_tickets } = w7

    if (p.p3 + p.p4plus > total_tickets * 0.30) {
      status = 'RED'
      recommendations.push('High 3rd+ pass rate detected; investigate recurring defects or unclear requirements.')
    }

    if (priorW7.weighted_story_points > 0 && w7.weighted_story_points < priorW7.weighted_story_points * 0.6) {
      status = 'RED'
      recommendations.push('Weighted story point output dropped significantly vs prior window.')
    }

    if (status !== 'RED') {
      if (p.p2 > total_tickets * 0.40) {
        status = 'YELLOW'
        recommendations.push('High second-pass rate; CR pushbacks increasing.')
      }
      if (w7.missing_story_points > total_tickets * 0.20) {
        status = 'YELLOW'
        recommendations.push('Large number of tickets missing story points.')
      }
      if (priorW7.weighted_story_points > 0) {
        const pctChange = ((w7.weighted_story_points - priorW7.weighted_story_points) / priorW7.weighted_story_points) * 100
        if (pctChange < -20) {
          status = 'YELLOW'
          recommendations.push('Weighted story points decreased more than 20% compared to prior window.')
        }
      }
    }

    if (recommendations.length === 0) recommendations.push('No immediate issues detected.')
    return { status, recommendations }
  }

  /**
   * Fetch and compute all CR metrics.
   * Windows: w7 (last 7d), prior_w7 (7–14d ago), w28 (last 28d), exclusions (28d pushbacks).
   */
  async processAll(mode: 'full' | 'incremental' = 'full'): Promise<CRData> {
    let w7Tickets, priorW7Tickets, w28Tickets, exclusions

    if (mode === 'incremental') {
      // Incremental: only fetch w7 (2 queries instead of 4)
      console.log('📊 [CR] Incremental mode — fetching w7 only')
      w7Tickets = await this.fetchFinalTickets(7, 0)
      priorW7Tickets = []
      w28Tickets = w7Tickets // Use w7 as approximation for w28 in incremental
      exclusions = []
    } else {
      ;[w7Tickets, priorW7Tickets, w28Tickets, exclusions] = await Promise.all([
        this.fetchFinalTickets(7, 0),
        this.fetchFinalTickets(7, 7),
        this.fetchFinalTickets(28, 0),
        this.fetchPushbackTickets(28, 0),
      ])
    }

    const w7     = this.computeWindowMetrics(w7Tickets)
    const priorW7 = this.computeWindowMetrics(priorW7Tickets)
    const w28    = this.computeWindowMetrics(w28Tickets)
    const { status, recommendations } = this.computeStatus(w7, priorW7)
    const owners       = this.computeOwners(w7Tickets)
    const priorW7Owners = this.computeOwners(priorW7Tickets)
    const monthlyOwners = this.computeOwners(w28Tickets)

    // rAgeCycle: compute separately for w7-window pushbacks and full w28 pushbacks
    const w7PushbackCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const w7Exclusions = exclusions.map(ex => ({
      ...ex,
      pushback_history: ex.pushback_history.filter(
        e => new Date(e.pushback_activity.timestamp).getTime() >= w7PushbackCutoff
      ),
    })).filter(ex => ex.pushback_history.length > 0)

    const cycleTimes: CRCycleTimes = {
      r_age_cycle_w7: this.computeRAgeCycle(w7Exclusions),
      r_age_cycle_w28: this.computeRAgeCycle(exclusions),
    }

    const pctChange = (cur: number, prior: number) =>
      prior === 0
        ? cur === 0 ? 0 : 100
        : parseFloat((((cur - prior) / prior) * 100).toFixed(2))

    return {
      w7,
      prior_w7: priorW7,
      w28,
      owners,
      prior_w7_owners: priorW7Owners,
      monthly_owners: monthlyOwners,
      exclusions,
      cycle_times: cycleTimes,
      status,
      recommendations,
      deltas: {
        weighted_sp_change_pct: pctChange(w7.weighted_story_points, priorW7.weighted_story_points),
        raw_sp_change_pct: pctChange(w7.raw_story_points, priorW7.raw_story_points),
      },
      report_date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    }
  }
}
