/**
 * Jira API Client
 * Handles authentication and API requests to Jira
 */

export interface JiraTicket {
  id: string
  key: string
  fields: {
    created: string
    summary: string
    status: {
      name: string
    }
    priority: {
      name: string
    }
    assignee?: {
      displayName: string
    }
    customfield_10028?: number // Story Points
    customfield_10034?: Array<{ displayName: string }> // Developer
    statuscategorychangedate: string
  }
  changelog?: {
    histories: Array<{
      id: string
      created: string
      author: {
        displayName: string
      }
      items: Array<{
        field: string
        fromString: string
        toString: string
      }>
    }>
  }
}

export interface JiraConfig {
  baseUrl: string
  email: string
  apiToken: string
}

export class JiraClient {
  private baseUrl: string
  private authHeader: string

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
    this.authHeader = `Basic ${auth}`
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(jql: string, expand?: string[]): Promise<JiraTicket[]> {
    // Use the new /search/jql endpoint as per Jira Cloud API migration
    const params = new URLSearchParams({
      jql,
      maxResults: '1000'
    })

    if (expand && expand.length > 0) {
      params.append('expand', expand.join(','))
    }

    const url = `${this.baseUrl}/rest/api/3/search/jql?${params.toString()}`
    console.log('🔍 [Jira Client] Searching issues with JQL:', jql.substring(0, 100))
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [Jira Client] API Error:', {
        status: response.status,
        statusText: response.statusText,
        url: url.substring(0, 100),
        error: errorText.substring(0, 500)
      })
      throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`)
    }

    const data = await response.json()
    return data.issues || []
  }

  /**
   * Get issue with changelog
   */
  async getIssueWithChangelog(issueKey: string): Promise<JiraTicket> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}?expand=changelog`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [Jira Client] Get Issue Error:', {
        issueKey,
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      })
      throw new Error(`Jira API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`)
    }

    return await response.json()
  }

  /**
   * Batch get issues with changelog
   */
  async batchGetIssuesWithChangelog(issueKeys: string[]): Promise<JiraTicket[]> {
    const batchSize = 50 // Process in batches to avoid rate limits
    const results: JiraTicket[] = []

    for (let i = 0; i < issueKeys.length; i += batchSize) {
      const batch = issueKeys.slice(i, i + batchSize)
      const promises = batch.map(key => this.getIssueWithChangelog(key))
      const batchResults = await Promise.all(promises)
      results.push(...batchResults)

      // Small delay to avoid rate limiting
      if (i + batchSize < issueKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }
}

/**
 * Create Jira client from environment variables
 */
export function createJiraClient(): JiraClient {
  const baseUrl = process.env.JIRA_BASE_URL
  const email = process.env.JIRA_EMAIL
  const apiToken = process.env.JIRA_API_TOKEN

  if (!baseUrl || !email || !apiToken) {
    throw new Error('Missing Jira configuration. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN')
  }

  return new JiraClient({ baseUrl, email, apiToken })
}
