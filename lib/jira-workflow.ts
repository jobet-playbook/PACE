/**
 * Jira Workflow Processing
 * Replicates the n8n workflow logic internally
 */

import { JiraClient, JiraTicket } from './jira-client'

// ============================================================
// TYPES
// ============================================================

export interface RollbackWindow {
  title: string
  key: string
  days: number
  prior_days: number
}

export interface QAAssignee {
  historyId: string
  qa_member: string
  status: string
}

export interface TicketWithQAData extends JiraTicket {
  qa_assignees: QAAssignee[]
  latest_qa_instance: Date | null
  latest_status_instance: Date | null
  qa_repetition_count: number
  first_qa_instance?: Date | null
}

export interface CycleTimeMetrics {
  to_qa_avg_bd: number
  to_done_avg_bd: number
  to_pushback_avg_bd: number
}

export interface ThroughputMetrics {
  total_story_points: number
  total_qa_phase_story_points: number
  total_tickets: number
  per_qa_member_throughput: Array<{
    qa_name: string
    unique_ticket_count: number
    unique_ticket_story_points: number
    ticket_story_points: number
    ticket_count: number
    tickets: Array<{
      ticket_key: string
      story_points: number
      history_id: string
      handled_stage: string
    }>
  }>
}

export interface WIPMetrics {
  total_tickets: number
  total_story_points: number
  old_qa_wip_tickets: Array<{
    ticket_key: string
    initial_qa_date: string
    latest_qa_date: string
    qa_repetition_count: number
    assignee: string
    developer: string
    story_points: number
    qa_status: string
    priority: string
    age_bd: number
    recent_age_bd: number
    summary: string
  }>
  critical_qa_wip_tickets: Array<{
    ticket_key: string
    initial_qa_date: string
    latest_qa_date: string
    qa_repetition_count: number
    assignee: string
    developer: string
    story_points: number
    qa_status: string
    priority: string
    age_bd: number
    recent_age_bd: number
    summary: string
  }>
  per_qa_member_qa_in_progress: Array<{
    qa_assignee: string
    qa_tickets_wip_count: number
    qa_tickets_wip_story_points_total: number
    tickets: Array<{
      ticket_key: string
      story_points: number
      qa_status: string
      age_bd: number
      recent_age_bd: number
      summary: string
    }>
  }>
}

export interface DefectMetrics {
  escaped_defects_count: number
  critical_defects: {
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

export interface RollbackWindowData {
  rollback_window_description: string
  cycle_time: CycleTimeMetrics
  qa_in_progress: WIPMetrics
  defects: DefectMetrics
  throughput: ThroughputMetrics
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const COUNTED_STATUS = ['Quality Assurance']

const ROLLBACK_WINDOWS: RollbackWindow[] = [
  { title: 'Last 7 Days', key: 'w7', days: 7, prior_days: 0 },
  { title: 'Last 28 Days', key: 'w28', days: 28, prior_days: 0 },
  { title: 'Last 7 Days Prior To W7', key: 'prior_w7', days: 7, prior_days: 7 },
  { title: 'Last 28 Days Prior To W28', key: 'prior_w28', days: 28, prior_days: 28 }
]

/**
 * Calculate business days between two dates
 */
export function getBusinessDays(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const diffDays = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
  
  const fullWeeks = Math.floor(diffDays / 7)
  let businessDays = fullWeeks * 5
  
  const remainingDays = diffDays % 7
  const startDay = start.getDay()
  
  for (let i = 0; i < remainingDays; i++) {
    const day = (startDay + i) % 7
    if (day !== 0 && day !== 6) {
      businessDays++
    }
  }

  return businessDays
}

/**
 * Extract QA members and instances from ticket changelog
 */
export function extractQAMembers(ticket: JiraTicket): TicketWithQAData {
  const assignees: QAAssignee[] = []
  let latestQAInstance: Date | null = null
  let latestStatusInstance: Date | null = null
  let firstQAInstance: Date | null = null
  let qa_repetition_count = 0

  const qaStatus = new Set(COUNTED_STATUS)

  if (!ticket.changelog?.histories) {
    return {
      ...ticket,
      qa_assignees: assignees,
      latest_qa_instance: latestQAInstance,
      latest_status_instance: latestStatusInstance,
      first_qa_instance: firstQAInstance,
      qa_repetition_count
    }
  }

  for (const history of ticket.changelog.histories) {
    for (const item of history.items) {
      // Track QA assignments
      if (item.field === 'status' && qaStatus.has(item.toString)) {
        const created = new Date(history.created)
        
        if (latestQAInstance === null || created > latestQAInstance) {
          latestQAInstance = created
        }
        
        if (firstQAInstance === null || created < firstQAInstance) {
          firstQAInstance = created
        }

        assignees.push({
          historyId: history.id,
          qa_member: history.author.displayName,
          status: item.fromString
        })
      }

      // Track QA repetitions (pushbacks)
      if (item.field === 'status' && qaStatus.has(item.fromString) && item.toString === 'In Progress') {
        qa_repetition_count += 1
      }

      // Track Done transitions
      if (item.field === 'status' && item.toString === 'Done') {
        const created = new Date(history.created)
        if (latestStatusInstance === null || created > latestStatusInstance) {
          latestStatusInstance = created
        }
      }
    }
  }

  return {
    ...ticket,
    qa_assignees: assignees,
    latest_qa_instance: latestQAInstance,
    latest_status_instance: latestStatusInstance,
    first_qa_instance: firstQAInstance,
    qa_repetition_count
  }
}

/**
 * Extract QA instances for WIP tickets
 */
export function extractQAInstances(ticket: JiraTicket) {
  let latestQAInstance: Date | null = null
  let firstQAInstance: Date | null = null
  let qa_repetition_count = 0

  const qaStatus = new Set(COUNTED_STATUS)

  if (!ticket.changelog?.histories) {
    return {
      key: ticket.key,
      id: ticket.id,
      first_qa_instance: firstQAInstance,
      latest_qa_instance: latestQAInstance,
      qa_repetition_count
    }
  }

  for (const history of ticket.changelog.histories) {
    for (const item of history.items) {
      if (item.field === 'status' && qaStatus.has(item.toString)) {
        const created = new Date(history.created)
        
        if (latestQAInstance === null || created > latestQAInstance) {
          latestQAInstance = created
        }
        
        if (firstQAInstance === null || created < firstQAInstance) {
          firstQAInstance = created
        }
      }

      if (item.field === 'status' && qaStatus.has(item.fromString) && item.toString === 'In Progress') {
        qa_repetition_count += 1
      }
    }
  }

  return {
    key: ticket.key,
    id: ticket.id,
    first_qa_instance: firstQAInstance,
    latest_qa_instance: latestQAInstance,
    qa_repetition_count
  }
}

// ============================================================
// METRICS CALCULATION
// ============================================================

/**
 * Calculate cycle time metrics
 */
export function calculateCycleTime(
  qaTickets: TicketWithQAData[],
  doneTickets: TicketWithQAData[],
  pushbackTickets: TicketWithQAData[]
): CycleTimeMetrics {
  // To QA: Created → First QA
  const toQAValues = qaTickets
    .filter(t => t.first_qa_instance)
    .map(t => {
      const created = new Date(t.fields.created)
      return getBusinessDays(created, t.first_qa_instance!)
    })

  // To Done: Latest QA → Done
  const toDoneValues = doneTickets
    .filter(t => t.latest_qa_instance && t.latest_status_instance)
    .map(t => getBusinessDays(t.latest_qa_instance!, t.latest_status_instance!))

  // To Pushback: Latest QA → Pushback
  const toPushbackValues = pushbackTickets
    .filter(t => t.latest_qa_instance && t.latest_status_instance)
    .map(t => getBusinessDays(t.latest_qa_instance!, t.latest_status_instance!))

  const average = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  return {
    to_qa_avg_bd: average(toQAValues),
    to_done_avg_bd: average(toDoneValues),
    to_pushback_avg_bd: average(toPushbackValues)
  }
}

/**
 * Calculate throughput metrics
 */
export function calculateThroughput(doneTickets: TicketWithQAData[]): ThroughputMetrics {
  const qa_throughput: Map<string, any> = new Map()
  let totalStoryPoints = 0
  let totalQAPhaseStoryPoints = 0

  for (const ticket of doneTickets) {
    const sp = ticket.fields.customfield_10028 || 0
    totalStoryPoints += sp

    if (sp !== 0) {
      totalQAPhaseStoryPoints += sp / (ticket.qa_repetition_count + 1)
    }

    for (const qa_assignee of ticket.qa_assignees) {
      const qaName = qa_assignee.qa_member.toLowerCase()
      
      if (!qa_throughput.has(qaName)) {
        qa_throughput.set(qaName, {
          qa_name: qa_assignee.qa_member,
          unique_ticket_count: 0,
          unique_ticket_story_points: 0,
          ticket_story_points: 0,
          ticket_count: 0,
          tickets: []
        })
      }

      const throughput = qa_throughput.get(qaName)
      const isDuplicate = throughput.tickets.some((t: any) => t.ticket_key === ticket.key)

      throughput.ticket_count += 1
      throughput.unique_ticket_count += !isDuplicate ? 1 : 0
      throughput.ticket_story_points += sp
      throughput.unique_ticket_story_points += !isDuplicate ? sp : 0

      throughput.tickets.push({
        ticket_key: ticket.key,
        story_points: sp,
        history_id: qa_assignee.historyId,
        handled_stage: qa_assignee.status
      })
    }
  }

  return {
    total_story_points: totalStoryPoints,
    total_qa_phase_story_points: totalQAPhaseStoryPoints,
    total_tickets: doneTickets.length,
    per_qa_member_throughput: Array.from(qa_throughput.values())
  }
}

/**
 * Calculate WIP metrics
 */
export function calculateWIP(qaTickets: TicketWithQAData[]): WIPMetrics {
  const criticalRiskStatus = new Set(['critical', 'highest'])
  const qa_in_progress: Map<string, any> = new Map()
  const old_tickets: any[] = []
  const critical_tickets: any[] = []
  let totalWipStoryPoints = 0

  const now = new Date()

  for (const ticket of qaTickets) {
    if (!ticket.first_qa_instance || !ticket.latest_qa_instance) continue

    const assigneeName = ticket.fields.assignee?.displayName ?? 'unassigned'
    const sp = ticket.fields.customfield_10028 || 0
    const ticket_age_bd = getBusinessDays(ticket.first_qa_instance, now)
    const latest_ticket_age_bd = getBusinessDays(ticket.latest_qa_instance, now)

    if (!qa_in_progress.has(assigneeName)) {
      qa_in_progress.set(assigneeName, {
        qa_assignee: assigneeName,
        qa_tickets_wip_count: 0,
        qa_tickets_wip_story_points_total: 0,
        tickets: []
      })
    }

    const qa_entry = qa_in_progress.get(assigneeName)
    qa_entry.qa_tickets_wip_count += 1
    qa_entry.qa_tickets_wip_story_points_total += sp

    qa_entry.tickets.push({
      ticket_key: ticket.key,
      story_points: sp,
      qa_status: ticket.fields.status.name,
      age_bd: ticket_age_bd,
      recent_age_bd: latest_ticket_age_bd,
      summary: ticket.fields.summary
    })

    // Old tickets (age > 3 days)
    if (ticket_age_bd > 3) {
      old_tickets.push({
        ticket_key: ticket.key,
        initial_qa_date: ticket.first_qa_instance.toISOString(),
        latest_qa_date: ticket.latest_qa_instance.toISOString(),
        qa_repetition_count: ticket.qa_repetition_count || 0,
        assignee: assigneeName,
        developer: ticket.fields.customfield_10034?.[0]?.displayName || 'Unknown',
        story_points: sp,
        qa_status: ticket.fields.status.name,
        priority: ticket.fields.priority.name,
        age_bd: ticket_age_bd,
        recent_age_bd: latest_ticket_age_bd,
        summary: ticket.fields.summary
      })
    }

    // Critical tickets
    if (criticalRiskStatus.has(ticket.fields.priority.name.toLowerCase()) && ticket_age_bd >= 1) {
      critical_tickets.push({
        ticket_key: ticket.key,
        initial_qa_date: ticket.first_qa_instance.toISOString(),
        latest_qa_date: ticket.latest_qa_instance.toISOString(),
        qa_repetition_count: ticket.qa_repetition_count || 0,
        assignee: assigneeName,
        developer: ticket.fields.customfield_10034?.[0]?.displayName || 'Unknown',
        story_points: sp,
        qa_status: ticket.fields.status.name,
        priority: ticket.fields.priority.name,
        age_bd: ticket_age_bd,
        recent_age_bd: latest_ticket_age_bd,
        summary: ticket.fields.summary
      })
    }

    totalWipStoryPoints += sp
  }

  return {
    total_tickets: qaTickets.length,
    total_story_points: totalWipStoryPoints,
    old_qa_wip_tickets: old_tickets,
    critical_qa_wip_tickets: critical_tickets,
    per_qa_member_qa_in_progress: Array.from(qa_in_progress.values())
  }
}

/**
 * Calculate defect metrics
 */
export function calculateDefects(defectTickets: JiraTicket[]): DefectMetrics {
  if (!defectTickets.length || !defectTickets[0].key) {
    return {
      escaped_defects_count: 0,
      critical_defects: {
        total_count: 0,
        unresolved_count: 0,
        resolved_count: 0,
        old_unresolved: []
      }
    }
  }

  const criticalRiskStatus = new Set(['critical', 'highest'])
  const now = new Date()

  const critical_defects = defectTickets.filter(d => 
    criticalRiskStatus.has(d.fields.priority.name.toLowerCase())
  )

  const unresolved_count = critical_defects.filter(d => d.fields.status.name !== 'Done').length
  const resolved_count = critical_defects.filter(d => d.fields.status.name === 'Done').length

  const old_unresolved = defectTickets
    .map(d => {
      const lastUpdate = new Date(d.fields.statuscategorychangedate)
      return {
        key: d.key,
        summary: d.fields.summary,
        status: d.fields.status.name,
        priority: d.fields.priority.name,
        age_bd: getBusinessDays(lastUpdate, now)
      }
    })
    .filter(d => 
      d.age_bd >= 1 && 
      criticalRiskStatus.has(d.priority.toLowerCase()) && 
      d.status !== 'Done'
    )

  return {
    escaped_defects_count: defectTickets.length,
    critical_defects: {
      total_count: critical_defects.length,
      unresolved_count,
      resolved_count,
      old_unresolved
    }
  }
}

// ============================================================
// MAIN WORKFLOW PROCESSOR
// ============================================================

export class JiraWorkflowProcessor {
  private jiraClient: JiraClient

  constructor(jiraClient: JiraClient) {
    this.jiraClient = jiraClient
  }

  /**
   * Build JQL for a rollback window
   */
  private buildJQL(window: RollbackWindow, status: string[], statusChange: 'TO' | 'FROM'): string {
    const projects = ['Playbook SaaS - Scrum', 'PlayBook App']
    const statusList = status.map(s => `"${s}"`).join(', ')
    
    const startDay = -(window.days + window.prior_days)
    const endDay = -window.prior_days

    if (statusChange === 'TO') {
      // For WIP tickets - currently IN the status
      return `project in (${projects.map(p => `"${p}"`).join(', ')}) AND status IN (${statusList}) ORDER BY updated DESC`
    } else {
      // For Done/Pushback tickets - CHANGED FROM the status
      return `project in (${projects.map(p => `"${p}"`).join(', ')}) AND status CHANGED FROM (${statusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`
    }
  }

  /**
   * Process a single rollback window
   */
  async processRollbackWindow(window: RollbackWindow): Promise<RollbackWindowData> {
    console.log(`📊 Processing rollback window: ${window.title}`)

    // Fetch tickets
    const [doneTickets, wipTickets, defectTickets, pushbackTickets] = await Promise.all([
      // Done tickets - tickets that moved FROM QA status TO Done
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED FROM (${COUNTED_STATUS.map(s => `"${s}"`).join(', ')}) TO ("Done") AFTER startOfDay(${-(window.days + window.prior_days)}) BEFORE endOfDay(${-window.prior_days}) ORDER BY updated DESC`,
        ['changelog']
      ),
      
      // WIP tickets - tickets currently IN QA status
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status IN (${COUNTED_STATUS.map(s => `"${s}"`).join(', ')}) ORDER BY updated DESC`,
        ['changelog']
      ),
      
      // Defect tickets - tickets that went back from Done to In Progress
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status NOT IN ("Done") AND status CHANGED FROM ("Done") TO ("Open", "In Progress") AFTER startOfDay(${-(window.days + window.prior_days)}) BEFORE endOfDay(${-window.prior_days}) ORDER BY updated DESC`
      ),
      
      // Pushback tickets - tickets that moved FROM QA back to In Progress
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED FROM (${COUNTED_STATUS.map(s => `"${s}"`).join(', ')}) TO ("In Progress") AFTER startOfDay(${-(window.days + window.prior_days)}) BEFORE endOfDay(${-window.prior_days}) ORDER BY updated DESC`,
        ['changelog']
      )
    ])

    console.log(`  ✓ Done: ${doneTickets.length}, WIP: ${wipTickets.length}, Defects: ${defectTickets.length}, Pushback: ${pushbackTickets.length}`)

    // Get changelogs for done tickets
    const doneWithHistory = await this.jiraClient.batchGetIssuesWithChangelog(
      doneTickets.map(t => t.key)
    )
    const doneWithQAData = doneWithHistory.map(extractQAMembers)

    // Get changelogs for WIP tickets
    const wipWithHistory = wipTickets.length > 0 
      ? await this.jiraClient.batchGetIssuesWithChangelog(wipTickets.map(t => t.key))
      : []
    const wipWithQAData = wipWithHistory.map(extractQAMembers)

    // Get changelogs for pushback tickets
    const pushbackWithHistory = pushbackTickets.length > 0
      ? await this.jiraClient.batchGetIssuesWithChangelog(pushbackTickets.map(t => t.key))
      : []
    const pushbackWithQAData = pushbackWithHistory.map(extractQAMembers)

    // Calculate metrics
    const cycle_time = calculateCycleTime(wipWithQAData, doneWithQAData, pushbackWithQAData)
    const throughput = calculateThroughput(doneWithQAData)
    const qa_in_progress = calculateWIP(wipWithQAData)
    const defects = calculateDefects(defectTickets)

    return {
      rollback_window_description: window.title,
      cycle_time,
      qa_in_progress,
      defects,
      throughput
    }
  }

  /**
   * Process all rollback windows
   */
  async processAllWindows(): Promise<Record<string, RollbackWindowData>> {
    const results: Record<string, RollbackWindowData> = {}

    for (const window of ROLLBACK_WINDOWS) {
      results[window.key] = await this.processRollbackWindow(window)
    }

    // Deduplicate critical and old WIP tickets across windows
    const allCritical = new Set<string>()
    const allOld = new Set<string>()
    const critical_qa_wip_tickets: any[] = []
    const old_qa_wip_tickets: any[] = []

    for (const data of Object.values(results)) {
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

    return results
  }
}
