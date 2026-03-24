/**
 * Documentation / PRD Workflow Processor — mirrors Code Review workflow logic
 *
 * Tracks tickets that enter "In Progress" (Ready for Dev), counts pushbacks
 * (re-entries to Open/Elaboration), and computes per-owner (creator) weighted SP output.
 *
 * tracked_status   = ["Open", "Elaboration"]   — PRD work-in-progress
 * target_status    = ["In Progress"]            — Ready for Dev (the milestone)
 * pushback_status  = ["Open", "Elaboration"]    — where tickets go when pushed back
 */

import { JiraClient } from './jira-client'

const TARGET_STATUS   = ['In Progress']
const PUSHBACK_STATUS = ['Open', 'Elaboration']
const TRACKED_STATUS  = ['Open', 'Elaboration']
const CRITICAL_PRIORITIES = ['High', 'Highest']
const AGING_THRESHOLD_BD = 3
const PROJECTS = '"Playbook SaaS - Scrum", "PlayBook App"'
const FIELDS = 'customfield_10028,customfield_10034,created,summary,status,priority,assignee,creator'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocFinalTicket {
  key: string
  creator: string
  tracked_pass_count: number   // 1 = first-pass, 2+ = had pushbacks
  story_points: number | null
  d_cycle_days: number | null  // days from ticket creation → first tracked entry
  t_cycle_days: number | null  // days from first tracked entry → Ready for Dev
}

export interface DocPushbackEntry {
  assignee: string
  pass_number: number
  target_activity: { stage: string; timestamp: string } | null
  pushback_activity: { status: string; timestamp: string }
}

export interface DocPushbackTicket {
  key: string
  pass_count: number
  pushback_history: DocPushbackEntry[]
}

export interface DocOwnerTicket {
  key: string
  story_points: number | null
  tracked_pass_count: number
}

export interface DocOwner {
  owner: string
  ticket_count: number
  ticket_keys: string
  tickets: DocOwnerTicket[]
  raw_sp: number
  weighted_sp: number
  missing_sp: number
  first_pass_count: number
  repeat_pass_count: number
  first_pass_sp: number
  repeat_pass_sp: number
}

export interface DocWindowMetrics {
  total_tickets: number
  raw_story_points: number
  weighted_story_points: number
  missing_story_points: number
  first_pass_sp: number
  repeat_pass_sp: number
  quality_issues: number        // tickets requiring 3+ passes
  d_cycle_avg_days: number      // avg days from creation → first tracked entry
  t_cycle_avg_days: number      // avg days from first tracked entry → Ready for Dev
  pass_distribution: { p1: number; p2: number; p3: number; p4plus: number }
}

export interface DocCycleTimes {
  r_age_cycle_w7: number    // avg calendar days in tracked before pushback (last 7d)
  r_age_cycle_w28: number   // avg calendar days in tracked before pushback (last 28d)
}

export interface DocWIPTicket {
  key: string
  summary: string
  creator: string
  assignee: string
  developer: string
  story_points: number | null
  priority: string
  status: string
  age_bd: number
  recent_age_bd: number
  first_tracked_date: string
  latest_tracked_date: string
  tracked_pass_count: number
}

export interface DocWIPData {
  total_tickets: number
  total_story_points: number
  old_prd_wip_tickets: DocWIPTicket[]
  critical_prd_wip_tickets: DocWIPTicket[]
  per_owner_in_progress: { owner: string; ticket_count: number; story_points: number }[]
}

export interface DocData {
  w7: DocWindowMetrics
  prior_w7: DocWindowMetrics
  w28: DocWindowMetrics
  owners: DocOwner[]              // per-owner, from w7 final tickets
  prior_w7_owners: DocOwner[]     // per-owner, from prior_w7 final tickets
  monthly_owners: DocOwner[]      // per-owner, from w28 final tickets
  exclusions: DocPushbackTicket[] // tickets with pushbacks, from w28
  cycle_times: DocCycleTimes
  wip: DocWIPData
  status: 'GREEN' | 'YELLOW' | 'RED'
  recommendations: string[]
  deltas: { weighted_sp_change_pct: number; raw_sp_change_pct: number }
  report_date: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Count business days between two timestamps */
function businessDaysBetween(startMs: number, endMs: number): number {
  let count = 0
  const d = new Date(startMs)
  while (d.getTime() < endMs) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// ── Processor ─────────────────────────────────────────────────────────────────

export class DocumentationWorkflowProcessor {
  constructor(private jiraClient: JiraClient) {}

  /**
   * Fetch tickets that reached the target status (In Progress / Ready for Dev)
   * in the given window, counting how many passes each ticket required.
   */
  private async fetchFinalTickets(days: number, priorDays: number): Promise<DocFinalTicket[]> {
    const startDay = -(days + priorDays)
    const endDay = -priorDays
    const targetList = TARGET_STATUS.map(s => `"${s}"`).join(', ')

    const tickets = await this.jiraClient.searchIssues(
      `project in (${PROJECTS}) AND status CHANGED TO (${targetList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
      ['changelog'],
      { fields: FIELDS }
    )

    const targetSet   = new Set(TARGET_STATUS)
    const pushbackSet = new Set(PUSHBACK_STATUS)

    return tickets.map((ticket: any) => {
      let trackedPassCount = 1
      let firstTrackedTimestamp: number | null = null
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

          // First time entering a tracked status (Open/Elaboration)
          if (new Set(TRACKED_STATUS).has(item.toString) && firstTrackedTimestamp === null) {
            firstTrackedTimestamp = historyMs
          }

          // Target → Pushback = re-entry
          if (targetSet.has(item.fromString) && pushbackSet.has(item.toString)) {
            trackedPassCount++
          }

          // Target → any forward status (not a pushback) = T-Cycle end
          if (targetSet.has(item.fromString) && !pushbackSet.has(item.toString)) {
            if (readyForDevTimestamp === null) readyForDevTimestamp = historyMs
          }
        }
      }

      // If no tracked status entry found in changelog, use creation date
      if (firstTrackedTimestamp === null && createdMs !== null) {
        firstTrackedTimestamp = createdMs
      }

      // If ticket is currently in target and never left forward, use latest target entry
      if (readyForDevTimestamp === null) {
        for (const history of [...histories].reverse()) {
          const historyMs = new Date(history.created).getTime()
          for (const item of (history.items ?? [])) {
            if (item.field === 'status' && targetSet.has(item.toString)) {
              readyForDevTimestamp = historyMs
              break
            }
          }
          if (readyForDevTimestamp !== null) break
        }
      }

      const dCycleDays = (createdMs !== null && firstTrackedTimestamp !== null)
        ? parseFloat(((firstTrackedTimestamp - createdMs) / MS_PER_DAY).toFixed(1))
        : null

      const tCycleDays = (firstTrackedTimestamp !== null && readyForDevTimestamp !== null)
        ? parseFloat(((readyForDevTimestamp - firstTrackedTimestamp) / MS_PER_DAY).toFixed(1))
        : null

      const spRaw = ticket.fields?.customfield_10028
      return {
        key: ticket.key,
        creator: ticket.fields?.creator?.displayName ?? 'Unknown',
        tracked_pass_count: trackedPassCount,
        story_points: typeof spRaw === 'number' ? spRaw : null,
        d_cycle_days: dCycleDays,
        t_cycle_days: tCycleDays,
      }
    })
  }

  /**
   * Fetch tickets that were pushed back from Target to Tracked status
   * in the given window, building a full pushback history per ticket.
   */
  private async fetchPushbackTickets(days: number, priorDays: number): Promise<DocPushbackTicket[]> {
    const startDay = -(days + priorDays)
    const endDay = -priorDays
    const targetList   = TARGET_STATUS.map(s => `"${s}"`).join(', ')
    const pushbackList = PUSHBACK_STATUS.map(s => `"${s}"`).join(', ')

    const tickets = await this.jiraClient.searchIssues(
      `project in (${PROJECTS}) AND status CHANGED FROM (${targetList}) TO (${pushbackList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
      ['changelog']
    )

    const targetSet   = new Set(TARGET_STATUS)
    const pushbackSet = new Set(PUSHBACK_STATUS)

    return tickets.map((ticket: any) => {
      const pushbackHistory: DocPushbackEntry[] = []
      let passCount = 1
      let currentTargetActivity: { stage: string; timestamp: string } | null = null

      const histories = [...(ticket.changelog?.histories ?? [])].sort(
        (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime()
      )

      for (const history of histories) {
        for (const item of [...(history.items ?? [])].reverse()) {
          if (item.field !== 'status') continue

          // Track last time ticket entered target
          if (targetSet.has(item.toString)) {
            if (!currentTargetActivity || new Date(history.created) > new Date(currentTargetActivity.timestamp)) {
              currentTargetActivity = { stage: item.toString, timestamp: history.created }
            }
          }

          // Target → Pushback = pushback event
          if (targetSet.has(item.fromString) && pushbackSet.has(item.toString)) {
            pushbackHistory.push({
              assignee: history.author?.displayName ?? 'Unknown',
              pass_number: passCount,
              target_activity: currentTargetActivity,
              pushback_activity: { status: item.toString, timestamp: history.created },
            })
            currentTargetActivity = null
            passCount++
          }
        }
      }

      return { key: ticket.key, pass_count: passCount, pushback_history: pushbackHistory }
    })
  }

  /**
   * Fetch tickets currently in tracked status (Open/Elaboration) — WIP.
   * Computes age, priority, assignee for aging/critical filtering.
   */
  private async fetchWIPTickets(days: number): Promise<DocWIPTicket[]> {
    const trackedList = TRACKED_STATUS.map(s => `"${s}"`).join(', ')

    const tickets = await this.jiraClient.searchIssues(
      `project in (${PROJECTS}) AND status IN (${trackedList}) AND status CHANGED TO (${trackedList}) AFTER startOfDay(-${days}) ORDER BY updated DESC`,
      ['changelog'],
      { fields: FIELDS }
    )

    const trackedSet  = new Set(TRACKED_STATUS)
    const targetSet   = new Set(TARGET_STATUS)
    const pushbackSet = new Set(PUSHBACK_STATUS)
    const now = Date.now()

    return tickets.map((ticket: any) => {
      let firstTrackedMs: number | null = null
      let latestTrackedMs: number | null = null
      let trackedPassCount = 1

      const histories = [...(ticket.changelog?.histories ?? [])].sort(
        (a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime()
      )

      for (const history of histories) {
        const historyMs = new Date(history.created).getTime()
        for (const item of [...(history.items ?? [])].reverse()) {
          if (item.field !== 'status') continue

          if (trackedSet.has(item.toString)) {
            if (firstTrackedMs === null) firstTrackedMs = historyMs
            latestTrackedMs = historyMs
          }

          // Target → Pushback = re-entry
          if (targetSet.has(item.fromString) && pushbackSet.has(item.toString)) {
            trackedPassCount++
          }
        }
      }

      // Fallback: use ticket creation date if no tracked transition found
      const createdMs = ticket.fields?.created ? new Date(ticket.fields.created).getTime() : now
      if (firstTrackedMs === null) firstTrackedMs = createdMs
      if (latestTrackedMs === null) latestTrackedMs = firstTrackedMs

      const ageBd = businessDaysBetween(firstTrackedMs, now)
      const recentAgeBd = businessDaysBetween(latestTrackedMs, now)

      const spRaw = ticket.fields?.customfield_10028
      const devField = ticket.fields?.customfield_10034
      const developer = Array.isArray(devField) && devField.length > 0
        ? devField[0].displayName
        : ticket.fields?.assignee?.displayName ?? 'Unassigned'

      return {
        key: ticket.key,
        summary: ticket.fields?.summary ?? '',
        creator: ticket.fields?.creator?.displayName ?? 'Unknown',
        assignee: ticket.fields?.assignee?.displayName ?? 'Unassigned',
        developer,
        story_points: typeof spRaw === 'number' ? spRaw : null,
        priority: ticket.fields?.priority?.name ?? 'None',
        status: ticket.fields?.status?.name ?? 'Unknown',
        age_bd: ageBd,
        recent_age_bd: recentAgeBd,
        first_tracked_date: new Date(firstTrackedMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
        latest_tracked_date: new Date(latestTrackedMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
        tracked_pass_count: trackedPassCount,
      }
    })
  }

  private computeWindowMetrics(tickets: DocFinalTicket[]): DocWindowMetrics {
    let weightedSP = 0, rawSP = 0, missingSP = 0
    let firstPassSP = 0, repeatPassSP = 0
    const passes = { p1: 0, p2: 0, p3: 0, p4plus: 0 }
    const dCycleSamples: number[] = []
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
          else weightedSP += t.story_points * 0.25
          repeatPassSP += t.story_points
        }
      }

      if (t.d_cycle_days !== null && t.d_cycle_days >= 0) dCycleSamples.push(t.d_cycle_days)
      if (t.t_cycle_days !== null && t.t_cycle_days >= 0) tCycleSamples.push(t.t_cycle_days)
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
      d_cycle_avg_days: avg(dCycleSamples),
      t_cycle_avg_days: avg(tCycleSamples),
      pass_distribution: passes,
    }
  }

  private computeOwners(tickets: DocFinalTicket[]): DocOwner[] {
    const ownerMap = new Map<string, DocFinalTicket[]>()
    for (const t of tickets) {
      if (!ownerMap.has(t.creator)) ownerMap.set(t.creator, [])
      ownerMap.get(t.creator)!.push(t)
    }

    const owners: DocOwner[] = []
    for (const [owner, ownerTickets] of ownerMap) {
      let rawSP = 0, weightedSP = 0, missingSP = 0
      let firstPassCount = 0, repeatPassCount = 0
      let firstPassSP = 0, repeatPassSP = 0
      const keys: string[] = []
      const tickets: DocOwnerTicket[] = []

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
            else weightedSP += t.story_points * 0.25
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
   * Compute average cycle time (calendar days) that tickets spent in target
   * before being pushed back. Uses pushback history timestamps.
   */
  private computeRAgeCycle(exclusions: DocPushbackTicket[]): number {
    const durations: number[] = []
    for (const ex of exclusions) {
      for (const entry of ex.pushback_history) {
        if (entry.target_activity?.timestamp && entry.pushback_activity?.timestamp) {
          const targetEntry = new Date(entry.target_activity.timestamp).getTime()
          const pushback    = new Date(entry.pushback_activity.timestamp).getTime()
          const days = (pushback - targetEntry) / MS_PER_DAY
          if (days >= 0) durations.push(days)
        }
      }
    }
    if (durations.length === 0) return 0
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length
    return parseFloat(avg.toFixed(1))
  }

  private computeWIPData(wipTickets: DocWIPTicket[]): DocWIPData {
    const totalSP = wipTickets.reduce((s, t) => s + (t.story_points ?? 0), 0)

    const old_prd_wip_tickets = wipTickets.filter(t => t.age_bd > AGING_THRESHOLD_BD)
    const critical_prd_wip_tickets = wipTickets.filter(t =>
      CRITICAL_PRIORITIES.includes(t.priority)
    )

    // Group by creator (owner)
    const ownerMap = new Map<string, { count: number; sp: number }>()
    for (const t of wipTickets) {
      const existing = ownerMap.get(t.creator) ?? { count: 0, sp: 0 }
      existing.count++
      existing.sp += t.story_points ?? 0
      ownerMap.set(t.creator, existing)
    }

    const per_owner_in_progress = Array.from(ownerMap.entries()).map(([owner, data]) => ({
      owner,
      ticket_count: data.count,
      story_points: data.sp,
    }))

    return {
      total_tickets: wipTickets.length,
      total_story_points: totalSP,
      old_prd_wip_tickets,
      critical_prd_wip_tickets,
      per_owner_in_progress,
    }
  }

  private computeStatus(w7: DocWindowMetrics, priorW7: DocWindowMetrics): { status: 'GREEN' | 'YELLOW' | 'RED'; recommendations: string[] } {
    let status: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN'
    const recommendations: string[] = []
    const { pass_distribution: p, total_tickets } = w7

    if (total_tickets > 0 && (p.p3 + p.p4plus) > total_tickets * 0.30) {
      status = 'RED'
      recommendations.push('High 3rd+ pass rate detected; investigate recurring pushbacks or unclear requirements.')
    }

    if (priorW7.weighted_story_points > 0 && w7.weighted_story_points < priorW7.weighted_story_points * 0.6) {
      status = 'RED'
      recommendations.push('Weighted story point output dropped significantly vs prior window.')
    }

    if (status !== 'RED') {
      if (total_tickets > 0 && p.p2 > total_tickets * 0.40) {
        status = 'YELLOW'
        recommendations.push('High second-pass rate; documentation pushbacks increasing.')
      }
      if (total_tickets > 0 && w7.missing_story_points > total_tickets * 0.20) {
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
   * Fetch and compute all Documentation metrics.
   * Windows: w7 (last 7d), prior_w7 (7–14d ago), w28 (last 28d).
   */
  async processAll(mode: 'full' | 'incremental' = 'full'): Promise<DocData> {
    let w7Tickets, priorW7Tickets, w28Tickets, exclusions, wipTickets

    if (mode === 'incremental') {
      console.log('📊 [Doc] Incremental mode — fetching w7 + WIP only')
      ;[w7Tickets, wipTickets] = await Promise.all([
        this.fetchFinalTickets(7, 0),
        this.fetchWIPTickets(28),
      ])
      priorW7Tickets = []
      w28Tickets = w7Tickets
      exclusions = []
    } else {
      ;[w7Tickets, priorW7Tickets, w28Tickets, exclusions, wipTickets] = await Promise.all([
        this.fetchFinalTickets(7, 0),
        this.fetchFinalTickets(7, 7),
        this.fetchFinalTickets(28, 0),
        this.fetchPushbackTickets(28, 0),
        this.fetchWIPTickets(28),
      ])
    }

    const w7      = this.computeWindowMetrics(w7Tickets)
    const priorW7 = this.computeWindowMetrics(priorW7Tickets)
    const w28     = this.computeWindowMetrics(w28Tickets)
    const { status, recommendations } = this.computeStatus(w7, priorW7)
    const owners        = this.computeOwners(w7Tickets)
    const priorW7Owners = this.computeOwners(priorW7Tickets)
    const monthlyOwners = this.computeOwners(w28Tickets)
    const wip           = this.computeWIPData(wipTickets)

    // rAgeCycle: compute separately for w7-window pushbacks and full w28 pushbacks
    const w7PushbackCutoff = Date.now() - 7 * MS_PER_DAY
    const w7Exclusions = exclusions.map(ex => ({
      ...ex,
      pushback_history: ex.pushback_history.filter(
        e => new Date(e.pushback_activity.timestamp).getTime() >= w7PushbackCutoff
      ),
    })).filter(ex => ex.pushback_history.length > 0)

    const cycle_times: DocCycleTimes = {
      r_age_cycle_w7:  this.computeRAgeCycle(w7Exclusions),
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
      cycle_times,
      wip,
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
