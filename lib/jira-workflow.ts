/**
 * Jira Workflow Processing
 * Replicates the n8n workflow logic internally
 */

import { JiraClient, JiraTicket } from './jira-client'

// ============================================================
// TIMEZONE UTILITIES
// ============================================================

/**
 * Convert UTC date to EST/EDT
 */
function toEST(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date
  // Convert to EST (UTC-5) or EDT (UTC-4) depending on DST
  return new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
}

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
 * Calculate business days between two dates (in EST timezone)
 */
export function getBusinessDays(start: Date, end: Date): number {
  // Convert to EST for accurate business day calculation
  const startEST = toEST(start)
  const endEST = toEST(end)
  
  const msPerDay = 1000 * 60 * 60 * 24
  const diffDays = Math.floor((endEST.getTime() - startEST.getTime()) / msPerDay) + 1
  
  const fullWeeks = Math.floor(diffDays / 7)
  let businessDays = fullWeeks * 5
  
  const remainingDays = diffDays % 7
  const startDay = startEST.getDay()
  
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
    if (!history || !history.items) continue
    
    for (const item of history.items) {
      if (!item || !item.field) continue
      
      // Track QA assignments
      if (item.field === 'status' && qaStatus.has(item.toString)) {
        const created = history.created ? new Date(history.created) : new Date()
        
        if (latestQAInstance === null || created > latestQAInstance) {
          latestQAInstance = created
        }
        
        if (firstQAInstance === null || created < firstQAInstance) {
          firstQAInstance = created
        }

        assignees.push({
          historyId: history.id || '',
          qa_member: history.author?.displayName || 'Unknown',
          status: item.fromString || ''
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
    if (!history || !history.items) continue
    for (const item of history.items) {
      if (!item || !item.field) continue
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
    .filter(t => t.first_qa_instance && t.fields?.created)
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
  const qaStatus = new Set(COUNTED_STATUS)
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

      // Find the most recent exit FROM QA status TO a final status
      // Sorted descending so we get the latest exit (handles multiple QA cycles)
      const FINAL_STATUSES_QA = new Set(['Push Staging', 'Push Production', 'Done', 'Staging Test'])
      const qaExitHistory = [...(ticket.changelog?.histories ?? [])]
        .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .find((h: any) =>
          h.items.some((item: any) =>
            item.field === 'status' &&
            qaStatus.has(item.fromString) &&
            FINAL_STATUSES_QA.has(item.toString)
          )
        )

      throughput.tickets.push({
        ticket_key: ticket.key,
        story_points: sp,
        history_id: qa_assignee.historyId,
        handled_stage: qa_assignee.status,
        history_created: qaExitHistory?.created || ticket.fields.statuscategorychangedate,
        had_previous_returns: ticket.qa_repetition_count > 0,
        qa_return_cycles_count: ticket.qa_repetition_count
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
    if (!ticket || !ticket.fields) continue
    if (!ticket.first_qa_instance || !ticket.latest_qa_instance) continue

    const assigneeName = ticket.fields.assignee?.displayName ?? 'unassigned'
    const sp = ticket.fields.customfield_10028 || 0
    const ticket_age_bd = getBusinessDays(ticket.first_qa_instance, now)
    const latest_ticket_age_bd = getBusinessDays(ticket.latest_qa_instance, now)
    const statusName = ticket.fields.status?.name || 'Unknown'
    const priorityName = ticket.fields.priority?.name || 'None'
    const summary = ticket.fields.summary || 'No summary'

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
      qa_status: statusName,
      age_bd: ticket_age_bd,
      recent_age_bd: latest_ticket_age_bd,
      summary: summary
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
        qa_status: statusName,
        priority: priorityName,
        age_bd: ticket_age_bd,
        recent_age_bd: latest_ticket_age_bd,
        summary: summary
      })
    }

    // Critical tickets
    if (priorityName && criticalRiskStatus.has(priorityName.toLowerCase()) && ticket_age_bd >= 1) {
      critical_tickets.push({
        ticket_key: ticket.key,
        initial_qa_date: ticket.first_qa_instance.toISOString(),
        latest_qa_date: ticket.latest_qa_instance.toISOString(),
        qa_repetition_count: ticket.qa_repetition_count || 0,
        assignee: assigneeName,
        developer: ticket.fields.customfield_10034?.[0]?.displayName || 'Unknown',
        story_points: sp,
        qa_status: statusName,
        priority: priorityName,
        age_bd: ticket_age_bd,
        recent_age_bd: latest_ticket_age_bd,
        summary: summary
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
   * Matches n8n workflow structure with 3 queries instead of 4
   */
  async processRollbackWindow(window: RollbackWindow): Promise<RollbackWindowData> {
    console.log(`📊 Processing rollback window: ${window.title}`)

    const startDay = -(window.days + window.prior_days)
    const endDay = -window.prior_days
    const countedStatusList = COUNTED_STATUS.map(s => `"${s}"`).join(', ')
    const finalStatusList = '"Push Staging", "Push Production", "Done", "Staging Test"'
    const pushbackStatusList = '"In Progress"'

    // Fetch tickets using n8n workflow structure (3 queries instead of 4)
    const [finalStatusTickets, pushbackTickets, trackedStatusTickets] = await Promise.all([
      // 1. JIRA: Final Status - tickets that changed TO final status (Done, Push Staging, Push Production)
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED TO (${finalStatusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
        ['changelog'],
        { fields: 'customfield_10028,created,status,creator,statuscategorychangedate,summary,assignee' }
      ),
      
      // 2. JIRA: Pushback - tickets that moved FROM final status back TO In Progress
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status CHANGED FROM (${finalStatusList}) TO (${pushbackStatusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
        ['changelog']
      ),
      
      // 3. JIRA: Tracked Status - ALL tickets currently IN QA status (no date filter, matches n8n)
      this.jiraClient.searchIssues(
        `project in ("Playbook SaaS - Scrum", "PlayBook App") AND status IN (${countedStatusList}) ORDER BY updated DESC`,
        ['changelog'],
        { fields: 'created,summary,priority,assignee,status,customfield_10028,customfield_10034,statuscategorychangedate', maxResults: 1000 }
      )
    ])

    console.log(`  ✓ Final Status: ${finalStatusTickets.length}, Pushback: ${pushbackTickets.length}, Tracked Status (WIP): ${trackedStatusTickets.length}`)

    // Process tickets with QA data extraction
    // Note: n8n already includes changelog in the response, so we use the tickets directly
    const finalStatusWithQAData = finalStatusTickets.map(extractQAMembers)
    const trackedStatusWithQAData = trackedStatusTickets.map(extractQAMembers)
    const pushbackWithQAData = pushbackTickets.map(extractQAMembers)

    // Calculate metrics using n8n workflow data
    const cycle_time = calculateCycleTime(trackedStatusWithQAData, finalStatusWithQAData, pushbackWithQAData)
    const throughput = calculateThroughput(finalStatusWithQAData)
    const qa_in_progress = calculateWIP(trackedStatusWithQAData)
    
    // Defects are derived from pushback tickets (tickets that went back to In Progress)
    const defects: DefectMetrics = {
      escaped_defects_count: pushbackTickets.length,
      critical_defects: {
        total_count: 0,
        unresolved_count: 0,
        resolved_count: 0,
        old_unresolved: []
      }
    }

    return {
      rollback_window_description: window.title,
      cycle_time,
      qa_in_progress,
      defects,
      throughput
    }
  }

  /**
   * Process a single-day window with full individual changelogs.
   * Used for w1 (today) and prior_w1 (yesterday) to get accurate per-member throughput.
   * startDay/endDay are negative offsets (e.g. today = startDay=-1, endDay=0).
   */
  async processDailyWindow(title: string, startDay: number, endDay: number): Promise<ThroughputMetrics> {
    console.log(`📊 Processing daily window: ${title} (${startDay} to ${endDay})`)

    const finalStatusList = '"Push Staging", "Push Production", "Done", "Staging Test"'
    const projects = `"Playbook SaaS - Scrum", "PlayBook App"`

    // 1. Search for tickets that moved to final status in this day range (just keys)
    const candidates = await this.jiraClient.searchIssues(
      `project in (${projects}) AND status CHANGED TO (${finalStatusList}) AFTER startOfDay(${startDay}) BEFORE endOfDay(${endDay}) ORDER BY updated DESC`,
      [],
      { fields: 'summary', maxResults: 200 }
    )

    if (candidates.length === 0) {
      return { total_story_points: 0, total_qa_phase_story_points: 0, total_tickets: 0, per_qa_member_throughput: [] }
    }

    console.log(`  → ${candidates.length} tickets found for ${title}, fetching full changelogs...`)

    // 2. Fetch full changelogs individually (bypasses the 50-entry truncation in search API)
    const fullTickets = await this.jiraClient.batchGetIssuesWithChangelog(candidates.map((t: any) => t.key))

    // 3. Extract QA members and calculate throughput
    const withQAData = fullTickets.map(extractQAMembers)
    return calculateThroughput(withQAData)
  }

  /**
   * Process rollback windows.
   * @param windowKeys — if provided, only process these window keys (e.g. ['w7'] for incremental).
   *                     w1 and prior_w1 daily windows are always processed.
   */
  async processAllWindows(windowKeys?: string[]): Promise<Record<string, RollbackWindowData>> {
    const results: Record<string, RollbackWindowData> = {}

    // Run main windows sequentially to avoid overwhelming Jira rate limits
    const windowsToProcess = windowKeys
      ? ROLLBACK_WINDOWS.filter(w => windowKeys.includes(w.key))
      : ROLLBACK_WINDOWS

    for (const window of windowsToProcess) {
      results[window.key] = await this.processRollbackWindow(window)
    }

    // Compute prior-business-day offsets (handles weekends/Monday)
    const todayDow = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
    const priorBdOffset = todayDow === 1 ? -4 : todayDow === 0 ? -3 : -2 // Mon→Fri, Sun→Fri, else yesterday

    // Run daily windows in parallel — uses individual changelog fetches for accuracy
    const [w1Throughput, priorW1Throughput] = await Promise.all([
      this.processDailyWindow('Today', -1, 0),
      this.processDailyWindow('Previous Business Day', priorBdOffset, priorBdOffset + 1),
    ])

    // Store as minimal rollback window entries (throughput only, no WIP/defects)
    const emptyWip = { total_tickets: 0, total_story_points: 0, old_qa_wip_tickets: [], critical_qa_wip_tickets: [], per_qa_member_qa_in_progress: [] }
    const emptyDefects = { escaped_defects_count: 0, critical_defects: { total_count: 0, unresolved_count: 0, resolved_count: 0, old_unresolved: [] } }
    const emptyCycle = { to_qa_avg_bd: 0, to_done_avg_bd: 0, to_pushback_avg_bd: 0 }

    results.w1 = { rollback_window_description: 'Today', cycle_time: emptyCycle, throughput: w1Throughput, qa_in_progress: emptyWip, defects: emptyDefects }
    results.prior_w1 = { rollback_window_description: 'Previous Business Day', cycle_time: emptyCycle, throughput: priorW1Throughput, qa_in_progress: emptyWip, defects: emptyDefects }

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
