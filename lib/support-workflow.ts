/**
 * Support Workflow Processor
 *
 * Replicates the n8n Support workflow end-to-end:
 *   1. Search archived conversations from Front inbox
 *   2. Filter by resolved status_category
 *   3. Event-based filtering (ticket_status_update events)
 *   4. Fetch messages for qualifying conversations
 *   5. Detect agent via outbound message patterns (strict allow-list)
 *   6. Fix created_at from quoted email headers when broken
 *   7. Compute cycle times
 *   8. Heuristic complexity scoring (1–7 pace points)
 *   9. Aggregate per-agent and overall metrics
 */

import type { FrontClient, FrontConversation, FrontMessage } from './front-client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupportIssueData {
  id: string
  frontConversationId: string
  clientName: string
  summary: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  weight: number           // pace points (1–7)
  status: 'Resolved' | 'Open' | 'In Progress' | 'Pending Client'
  assignee: string
  dateOpened: string        // MM/DD/YY format for UI
  dateOpenedIso: string     // ISO for DB
  dateResolved: string | null
  dateResolvedIso: string | null
  hoursToResolve: number | null
  exceeds24Hours: boolean
}

export interface AgentStats {
  agent_name: string
  tickets_resolved: number
  total_pace_points: number
  avg_cycle_time: number
  median_cycle_time: number
  p90_cycle_time: number
}

export interface SupportMetricsData {
  report_date: string
  window_days: number
  total_tickets_resolved: number
  overall: {
    total_pace_points: number
    avg_cycle_time: number
    median_cycle_time: number
    p90_cycle_time: number
  }
  by_agent: AgentStats[]
  issues: SupportIssueData[]
  member_stats: {
    name: string
    issuesSolved: number
    weightedPace: number
    avgResolutionHours: number
    over24HourCount: number
  }[]
}

// ── Constants ────────────────────────────────────────────────────────────────

// 🔒 STRICT AGENT ALLOW-LIST (mirrors n8n validTeam)
const VALID_AGENTS = ['JP', 'James', 'Arlon', 'Liv', 'Dan', 'Gil']
const VALID_AGENTS_LOWER = VALID_AGENTS.map(n => n.toLowerCase())

// ── Agent Detection Heuristics ───────────────────────────────────────────────

// Mirrors n8n Code in JavaScript5 patterns exactly
const NAME_PATTERNS = [
  /(\w+)\s+here\b/i,
  /\bThis is\s+(\w+)\b/i,
  /\bMy name is\s+(\w+)\b/i,
  /(\w+)\s+from\s+(?:customer|support)/i,
  /\bBest,?\s*(\w+)\b/i,
  /\bThanks,?\s*(\w+)\b/i,
  /\bRegards,?\s*\n?\s*(\w+)\b/i,
  /\bCheers,?\s*\n?\s*(\w+)\b/i,
  /\bSincerely,?\s*\n?\s*(\w+)\b/i,
]

/**
 * Detect which agent handled a conversation by scanning outbound messages.
 * Mirrors n8n's Code in JavaScript5 detection logic:
 *   - Sort messages chronologically
 *   - Scan first 3 outbound messages, first 5 lines each
 *   - Match against strict allow-list
 *   - Falls back to "Unattributed"
 */
export function detectAgent(
  messages: FrontMessage[],
  frontAssignee?: { first_name?: string; last_name?: string }
): string {
  // Sort chronologically (earliest first)
  const sorted = [...messages].sort((a, b) => a.created_at - b.created_at)
  const outbound = sorted.filter(m => !m.is_inbound).slice(0, 3)

  for (const msg of outbound) {
    const text = msg.text || stripHtml(msg.body ?? '')
    if (!text) continue

    // n8n scans first 5 lines of the message
    const firstChunk = text.split('\n').slice(0, 5).join(' ')

    for (const pattern of NAME_PATTERNS) {
      const match = pattern.exec(firstChunk)
      if (match) {
        const name = match[1].toLowerCase()
        const idx = VALID_AGENTS_LOWER.indexOf(name)
        if (idx !== -1) {
          return name === 'jp' ? 'JP' : VALID_AGENTS[idx]
        }
      }
    }
  }

  // Fallback: check Front assignee against allow-list
  if (frontAssignee?.first_name) {
    const fname = frontAssignee.first_name.toLowerCase()
    const idx = VALID_AGENTS_LOWER.indexOf(fname)
    if (idx !== -1) return VALID_AGENTS[idx]
  }

  return 'Unattributed'
}

/** Strip HTML tags to get plain text */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Created-at Fix ──────────────────────────────────────────────────────────

/**
 * Fix conversation created_at when it's broken or equals resolved_date.
 * Parses quoted email headers ("> On ... wrote:") to find the original date.
 * Mirrors n8n's Code in JavaScript5 created_at fix logic exactly.
 */
function fixCreatedAt(
  conversationCreatedAt: number | null | undefined,
  resolvedDate: number | null,
  messages: FrontMessage[]
): number {
  if (conversationCreatedAt && resolvedDate && conversationCreatedAt !== resolvedDate) {
    return conversationCreatedAt
  }

  if (messages.length === 0) return conversationCreatedAt ?? Math.floor(Date.now() / 1000)

  const sorted = [...messages].sort((a, b) => a.created_at - b.created_at)
  const lastMsg = sorted[sorted.length - 1]
  const text = lastMsg.text || ''

  // Parse quoted email dates: "> On ... <email> wrote:"
  const quoteRegex = />\s*On\s+(.*?),\s*<.*?>\s*wrote:/gi
  const matches = [...text.matchAll(quoteRegex)]
  let oldestQuoteTime: number | null = null

  for (const match of matches) {
    const dateStr = match[1]
      .replace(/\s+at\s+/i, ' ')
      .replace(/\s+[A-Z]{3,4}\s+([+-]\d{4})/i, ' $1')

    const parsedDate = new Date(dateStr).getTime() / 1000
    if (!isNaN(parsedDate) && parsedDate > 0) {
      if (!oldestQuoteTime || parsedDate < oldestQuoteTime) {
        oldestQuoteTime = parsedDate
      }
    }
  }

  return oldestQuoteTime || sorted[0].created_at
}

// ── Scoring Heuristic ───────────────────────────────────────────────────────

/**
 * Heuristic complexity scoring (mirrors the n8n AI Agent's scoring rules):
 *   1 = Very simple response (macro, canned reply, link drop, status update)
 *   2 = Slight clarification or basic instruction
 *   3 = Moderate explanation or guided steps
 *   5 = Detailed troubleshooting with multiple steps or reasoning
 *   7 = Complex technical investigation or deep troubleshooting
 *
 * If unclear, assign the LOWER score (mirrors AI instruction).
 */
function scoreTicket(messages: FrontMessage[]): number {
  const outbound = messages.filter(m => !m.is_inbound)
  if (outbound.length === 0) return 1

  const allText = outbound
    .map(m => m.text || stripHtml(m.body ?? ''))
    .filter(Boolean)
    .join('\n')

  const totalChars = allText.length
  const lines = allText.split('\n').filter(l => l.trim()).length
  const outboundCount = outbound.length

  const hasSteps = /\b(step\s*\d|1\.\s|2\.\s|first[,:\s]|then[,:\s]|next[,:\s]|finally[,:\s])/i.test(allText)
  const hasCode = /```|`[^`]+`|<code>/i.test(allText)
  const hasTechnical = /\b(API|database|server|endpoint|config|setting|permission|cache|token|webhook|integration|error|bug|debug|log|DNS|SSL|OAuth|CORS|timeout)\b/i.test(allText)

  // 1 = Very simple: short single response, no technical content
  if (totalChars < 100 && outboundCount === 1 && !hasSteps && !hasTechnical) return 1

  // 2 = Basic instruction
  if (totalChars < 250 && !hasSteps && !hasCode) return 2

  // 7 = Complex technical investigation
  if (hasTechnical && (hasCode || lines > 15) && totalChars > 800) return 7

  // 5 = Detailed troubleshooting
  if ((hasSteps && hasTechnical) || (outboundCount >= 3 && totalChars > 500)) return 5

  // 3 = Moderate explanation or guided steps
  if (hasSteps || totalChars > 300 || outboundCount >= 2) return 3

  return 2
}

// ── Stats Helpers ────────────────────────────────────────────────────────────

function medianVal(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? Number(sorted[mid].toFixed(2))
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2))
}

function p90Val(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return Number(sorted[Math.max(0, Math.floor(sorted.length * 0.9) - 1)].toFixed(2))
}

function avgVal(arr: number[]): number {
  if (arr.length === 0) return 0
  return Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2))
}

// ── Date Formatting ──────────────────────────────────────────────────────────

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: '2-digit',
    timeZone: 'America/New_York',
  })
}

function toIso(unix: number): string {
  return new Date(unix * 1000).toISOString()
}

// ── Client Name Extraction ───────────────────────────────────────────────────

function extractClientName(conv: FrontConversation, messages: FrontMessage[]): string {
  if (conv.recipient?.name) return conv.recipient.name
  if (conv.recipient?.handle) return conv.recipient.handle

  const firstInbound = [...messages]
    .sort((a, b) => a.created_at - b.created_at)
    .find(m => m.is_inbound)
  if (firstInbound?.author?.first_name) {
    return [firstInbound.author.first_name, firstInbound.author.last_name].filter(Boolean).join(' ')
  }
  if (firstInbound?.author?.email) return firstInbound.author.email

  return 'Unknown'
}

// ── Main Processor ───────────────────────────────────────────────────────────

/**
 * Replicates the full n8n Support workflow:
 *   Step 1: Search archived conversations in inbox
 *   Step 2: Filter by resolved status_category
 *   Step 3–5: Event-based filtering (ticket_status_update)
 *   Step 6: Fetch messages for qualifying conversations
 *   Step 7: Process (agent detection, created_at fix, cycle time)
 *   Step 8: Score (heuristic 1–7)
 *   Step 9: Aggregate
 */
export interface ProcessSupportOptions {
  /** Skip event-based filtering to halve API calls. Default: false */
  skipEvents?: boolean
}

export async function processSupport(
  client: FrontClient,
  inboxId: string,
  windowDays: number,
  options: ProcessSupportOptions = {}
): Promise<SupportMetricsData> {
  const { skipEvents = false } = options
  const afterUnix = Math.floor((Date.now() - windowDays * 24 * 60 * 60 * 1000) / 1000)
  const query = `inbox:${inboxId} is:archived after:${afterUnix}`

  // ── Step 1: Search archived conversations ────────────────────────────
  console.log(`📬 [Support] Searching Front: ${query}`)
  const allConvs = await client.searchConversations(query)

  // ── Step 2: Filter by resolved status ────────────────────────────────
  const resolvedConvs = allConvs.filter(c =>
    c.status_category === 'resolved' || c.status === 'archived'
  )
  console.log(`📬 [Support] ${resolvedConvs.length} resolved of ${allConvs.length} total`)

  // ── Step 3–5: Event-based filtering (optional) ────────────────────────
  let conversations: FrontConversation[] = resolvedConvs

  if (!skipEvents && resolvedConvs.length > 0) {
    console.log(`📬 [Support] Fetching events for ${resolvedConvs.length} conversations...`)
    const eventsMap = await client.batchGetEvents(resolvedConvs.map(c => c.id), 2)

    const qualifyingConvMap = new Map<string, FrontConversation>()
    for (const conv of resolvedConvs) {
      const events = eventsMap.get(conv.id) ?? []
      for (const evt of events) {
        if (evt.type === 'ticket_status_update') {
          const evtConv = evt.conversation ?? conv
          qualifyingConvMap.set(evtConv.id, evtConv)
        }
      }
    }

    if (qualifyingConvMap.size > 0) {
      conversations = Array.from(qualifyingConvMap.values())
      console.log(`📬 [Support] ${conversations.length} conversations after event filtering`)
    } else {
      console.log(`📬 [Support] No ticket_status_update events found, using all ${resolvedConvs.length} resolved`)
    }
  } else if (skipEvents) {
    console.log(`📬 [Support] Skipping event filtering (skipEvents=true), using all ${resolvedConvs.length} resolved`)
  }

  // ── Step 6: Fetch messages ───────────────────────────────────────────
  console.log(`📬 [Support] Fetching messages for ${conversations.length} conversations...`)
  const messagesMap = await client.batchGetMessages(conversations.map(c => c.id), 2)

  // ── Step 7–8: Process each conversation ──────────────────────────────
  const issues: SupportIssueData[] = []
  const cycleTimes: number[] = []
  let totalPacePoints = 0

  for (const conv of conversations) {
    const messages = messagesMap.get(conv.id) ?? []
    if (messages.length === 0) continue

    const sorted = [...messages].sort((a, b) => a.created_at - b.created_at)

    // Agent detection (mirrors n8n Code JS5 + AI Agent3 verification)
    const agent = detectAgent(messages, conv.assignee)

    // Resolve date = last message timestamp
    const lastMsg = sorted[sorted.length - 1]
    const resolvedDate = lastMsg.created_at

    // Fix created_at (mirrors n8n Code JS5 created_at fix)
    const createdAt = fixCreatedAt(conv.created_at, resolvedDate, messages)

    // Cycle time (mirrors n8n: resolved_date - created_at, in hours)
    let cycleHours = 0
    if (createdAt && resolvedDate && createdAt < resolvedDate) {
      cycleHours = Number(((resolvedDate - createdAt) / 3600).toFixed(2))
    }
    cycleTimes.push(cycleHours)

    // Heuristic scoring (mirrors n8n AI Agent3 scoring rules)
    const score = scoreTicket(messages)
    totalPacePoints += score

    issues.push({
      id: conv.subject ? `SUP-${conv.id.slice(-4).toUpperCase()}` : conv.id,
      frontConversationId: conv.id,
      clientName: extractClientName(conv, messages),
      summary: conv.subject || 'No subject',
      priority: 'Medium',
      weight: score,
      status: 'Resolved',
      assignee: agent,
      dateOpened: formatDate(createdAt),
      dateOpenedIso: toIso(createdAt),
      dateResolved: formatDate(resolvedDate),
      dateResolvedIso: toIso(resolvedDate),
      hoursToResolve: cycleHours,
      exceeds24Hours: cycleHours > 24,
    })
  }

  // ── Step 9: Aggregate (mirrors n8n Code JS6) ─────────────────────────
  const agentMap = new Map<string, { cycleTimes: number[]; pacePoints: number }>()
  for (const issue of issues) {
    if (!agentMap.has(issue.assignee)) {
      agentMap.set(issue.assignee, { cycleTimes: [], pacePoints: 0 })
    }
    const a = agentMap.get(issue.assignee)!
    a.cycleTimes.push(issue.hoursToResolve ?? 0)
    a.pacePoints += issue.weight
  }

  const by_agent: AgentStats[] = Array.from(agentMap.entries())
    .map(([agent_name, data]) => ({
      agent_name,
      tickets_resolved: data.cycleTimes.length,
      total_pace_points: data.pacePoints,
      avg_cycle_time: avgVal(data.cycleTimes),
      median_cycle_time: medianVal(data.cycleTimes),
      p90_cycle_time: p90Val(data.cycleTimes),
    }))
    .sort((a, b) => b.total_pace_points - a.total_pace_points)

  // Member stats for dashboard UI
  const member_stats = by_agent.map(a => ({
    name: a.agent_name,
    issuesSolved: a.tickets_resolved,
    weightedPace: a.total_pace_points,
    avgResolutionHours: a.avg_cycle_time,
    over24HourCount: issues.filter(i => i.assignee === a.agent_name && i.exceeds24Hours).length,
  }))

  console.log(`📬 [Support] Processed ${issues.length} conversations, ${by_agent.length} agents, ${totalPacePoints} pace pts`)

  return {
    report_date: new Date().toISOString().split('T')[0],
    window_days: windowDays,
    total_tickets_resolved: issues.length,
    overall: {
      total_pace_points: totalPacePoints,
      avg_cycle_time: avgVal(cycleTimes),
      median_cycle_time: medianVal(cycleTimes),
      p90_cycle_time: p90Val(cycleTimes),
    },
    by_agent,
    issues,
    member_stats,
  }
}
