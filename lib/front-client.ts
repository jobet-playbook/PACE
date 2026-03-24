/**
 * Front API Client
 * Handles authentication, pagination, and rate-limit retries for Front conversations/messages.
 */

const BASE_URL = 'https://api2.frontapp.com'

export interface FrontConversation {
  id: string
  subject: string
  status: string
  status_category?: string  // e.g. 'resolved' (Front ticketing)
  created_at: number   // unix timestamp
  updated_at?: number
  _links: { related?: { messages?: { href: string } } }
  recipient?: { handle?: string; name?: string }
  assignee?: { email?: string; first_name?: string; last_name?: string }
}

export interface FrontEvent {
  id: string
  type: string            // 'ticket_status_update', 'assign', etc.
  emitted_at: number      // unix timestamp
  conversation?: FrontConversation
}

export interface FrontMessage {
  id: string
  type: string          // 'email', 'sms', etc.
  is_inbound: boolean
  created_at: number    // unix timestamp
  subject?: string
  text?: string         // plain text body
  body?: string         // HTML body (fallback)
  author?: {
    email?: string
    first_name?: string
    last_name?: string
  }
}

interface PaginatedResponse<T> {
  _results: T[]
  _pagination?: { next?: string }
}

export class FrontClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private async request<T>(url: string): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`

    const res = await fetch(fullUrl, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json',
      },
    })

    // Rate limit handling: wait and retry once
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
      console.warn(`⏳ [Front] Rate limited — waiting ${retryAfter}s...`)
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))

      const retryRes = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json',
        },
      })
      if (!retryRes.ok) {
        throw new Error(`Front API error after retry: ${retryRes.status} ${retryRes.statusText}`)
      }
      return retryRes.json()
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Front API error: ${res.status} ${res.statusText} — ${text.substring(0, 200)}`)
    }

    return res.json()
  }

  /**
   * Search conversations with auto-pagination.
   * Returns all matching conversations across pages.
   */
  async searchConversations(query: string, maxPages = 10): Promise<FrontConversation[]> {
    const conversations: FrontConversation[] = []
    let url: string | null = `/conversations/search/${encodeURIComponent(query)}`
    let page = 0

    while (url && page < maxPages) {
      const data: PaginatedResponse<FrontConversation> = await this.request<PaginatedResponse<FrontConversation>>(url)
      conversations.push(...(data._results ?? []))
      url = data._pagination?.next ?? null
      page++
    }

    console.log(`📬 [Front] Search returned ${conversations.length} conversations (${page} pages)`)
    return conversations
  }

  /**
   * Get all messages for a conversation, auto-paginating.
   */
  async getConversationMessages(conversationId: string): Promise<FrontMessage[]> {
    const messages: FrontMessage[] = []
    let url: string | null = `/conversations/${conversationId}/messages`
    let page = 0

    while (url && page < 5) {
      const data: PaginatedResponse<FrontMessage> = await this.request<PaginatedResponse<FrontMessage>>(url)
      messages.push(...(data._results ?? []))
      url = data._pagination?.next ?? null
      page++
    }

    return messages
  }

  /**
   * Get all events for a conversation, auto-paginating.
   * Mirrors n8n's events fetch: GET /conversations/{id}/events?limit=100&sort=desc
   */
  async getConversationEvents(conversationId: string): Promise<FrontEvent[]> {
    const events: FrontEvent[] = []
    let url: string | null = `/conversations/${conversationId}/events?limit=100&sort=desc`
    let page = 0

    while (url && page < 5) {
      const data: PaginatedResponse<FrontEvent> = await this.request<PaginatedResponse<FrontEvent>>(url)
      events.push(...(data._results ?? []))
      url = data._pagination?.next ?? null
      page++
    }

    return events
  }

  /**
   * Batch fetch messages for multiple conversations with concurrency limit.
   */
  async batchGetMessages(
    conversationIds: string[],
    concurrency = 2
  ): Promise<Map<string, FrontMessage[]>> {
    const results = new Map<string, FrontMessage[]>()

    for (let i = 0; i < conversationIds.length; i += concurrency) {
      const batch = conversationIds.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async id => {
          try {
            const msgs = await this.getConversationMessages(id)
            return { id, msgs }
          } catch (err) {
            console.warn(`⚠️ [Front] Failed to fetch messages for ${id}:`, err)
            return { id, msgs: [] }
          }
        })
      )

      for (const { id, msgs } of batchResults) {
        results.set(id, msgs)
      }

      // Rate-limit delay between batches
      if (i + concurrency < conversationIds.length) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    return results
  }

  /**
   * Batch fetch events for multiple conversations.
   * Mirrors n8n's event fetch step with rate-limit delays.
   */
  async batchGetEvents(
    conversationIds: string[],
    concurrency = 2
  ): Promise<Map<string, FrontEvent[]>> {
    const results = new Map<string, FrontEvent[]>()

    for (let i = 0; i < conversationIds.length; i += concurrency) {
      const batch = conversationIds.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async id => {
          try {
            const evts = await this.getConversationEvents(id)
            return { id, evts }
          } catch (err) {
            console.warn(`⚠️ [Front] Failed to fetch events for ${id}:`, err)
            return { id, evts: [] }
          }
        })
      )

      for (const { id, evts } of batchResults) {
        results.set(id, evts)
      }

      // Rate-limit delay between batches
      if (i + concurrency < conversationIds.length) {
        await new Promise(resolve => setTimeout(resolve, 4000))
      }
    }

    return results
  }
}

/**
 * Create Front client from environment variables.
 */
export function createFrontClient(): FrontClient {
  const token = process.env.FRONT_API_TOKEN
  if (!token) {
    throw new Error('Missing FRONT_API_TOKEN environment variable')
  }
  return new FrontClient(token)
}
