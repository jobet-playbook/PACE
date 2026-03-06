/**
 * Cache Pool Manager
 * 
 * Multi-layer caching system to combat rate limiting and improve performance:
 * 1. Memory cache (instant access)
 * 2. Supabase cache (persistent, shared across instances)
 * 3. Fallback to stale cache on errors
 */

import { createClient } from '@supabase/supabase-js'

// In-memory cache with TTL
interface CacheEntry {
  data: any
  timestamp: number
  expiresAt: number
}

class CachePool {
  private memoryCache: Map<string, CacheEntry> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly STALE_TTL = 24 * 60 * 60 * 1000 // 24 hours (for fallback)

  /**
   * Get data from cache (memory first, then Supabase)
   */
  async get(key: string): Promise<any | null> {
    // 1. Check memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
      console.log(`💾 [Cache] Memory hit for ${key} (age: ${Math.round((Date.now() - memoryEntry.timestamp) / 1000)}s)`)
      return memoryEntry.data
    }

    // 2. Check Supabase cache (persistent)
    try {
      const supabaseData = await this.getFromSupabase(key)
      if (supabaseData) {
        // Populate memory cache
        this.memoryCache.set(key, {
          data: supabaseData.data,
          timestamp: new Date(supabaseData.cached_at).getTime(),
          expiresAt: Date.now() + this.DEFAULT_TTL
        })
        console.log(`💾 [Cache] Supabase hit for ${key}`)
        return supabaseData.data
      }
    } catch (error) {
      console.error(`⚠️ [Cache] Supabase read error for ${key}:`, error)
    }

    return null
  }

  /**
   * Get stale data (for rate limit fallback)
   */
  async getStale(key: string): Promise<any | null> {
    // Check memory cache (even if expired)
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry) {
      const age = Date.now() - memoryEntry.timestamp
      if (age < this.STALE_TTL) {
        console.log(`⚠️ [Cache] Using stale memory cache for ${key} (age: ${Math.round(age / 1000)}s)`)
        return memoryEntry.data
      }
    }

    // Check Supabase for stale data
    try {
      const supabaseData = await this.getFromSupabase(key, true)
      if (supabaseData) {
        const age = Date.now() - new Date(supabaseData.cached_at).getTime()
        console.log(`⚠️ [Cache] Using stale Supabase cache for ${key} (age: ${Math.round(age / 1000)}s)`)
        return supabaseData.data
      }
    } catch (error) {
      console.error(`⚠️ [Cache] Stale Supabase read error for ${key}:`, error)
    }

    return null
  }

  /**
   * Set data in cache (both memory and Supabase)
   */
  async set(key: string, data: any, ttl?: number): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.DEFAULT_TTL)
    const timestamp = Date.now()

    // 1. Set in memory cache
    this.memoryCache.set(key, {
      data,
      timestamp,
      expiresAt
    })

    // 2. Set in Supabase cache (async, don't wait)
    this.setInSupabase(key, data, timestamp).catch(error => {
      console.error(`⚠️ [Cache] Supabase write error for ${key}:`, error)
    })

    console.log(`💾 [Cache] Stored ${key} in cache pool`)
  }

  /**
   * Clear specific cache key
   */
  async clear(key: string): Promise<void> {
    this.memoryCache.delete(key)
    await this.clearFromSupabase(key)
    console.log(`🗑️ [Cache] Cleared ${key}`)
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear()
    await this.clearAllFromSupabase()
    console.log(`🗑️ [Cache] Cleared all cache`)
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.memoryCache.entries())
    const now = Date.now()
    
    return {
      totalEntries: entries.length,
      validEntries: entries.filter(([_, entry]) => now < entry.expiresAt).length,
      expiredEntries: entries.filter(([_, entry]) => now >= entry.expiresAt).length,
      oldestEntry: entries.length > 0 
        ? Math.round((now - Math.min(...entries.map(([_, e]) => e.timestamp))) / 1000)
        : 0,
      newestEntry: entries.length > 0
        ? Math.round((now - Math.max(...entries.map(([_, e]) => e.timestamp))) / 1000)
        : 0
    }
  }

  /**
   * Cleanup expired entries from memory
   */
  cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [Cache] Cleaned ${cleaned} expired entries`)
    }
  }

  // ============================================
  // Supabase Cache Operations
  // ============================================

  private async getFromSupabase(key: string, allowStale = false): Promise<any | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('pace_cache_pool')
      .select('*')
      .eq('cache_key', key)
      .order('cached_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    // Check if cache is still valid
    const cacheAge = Date.now() - new Date(data.cached_at).getTime()
    const maxAge = allowStale ? this.STALE_TTL : this.DEFAULT_TTL

    if (cacheAge > maxAge) {
      return null
    }

    return data
  }

  private async setInSupabase(key: string, data: any, timestamp: number): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    await supabase
      .from('pace_cache_pool')
      .upsert({
        cache_key: key,
        data: data,
        cached_at: new Date(timestamp).toISOString()
      }, {
        onConflict: 'cache_key'
      })
  }

  private async clearFromSupabase(key: string): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    await supabase
      .from('pace_cache_pool')
      .delete()
      .eq('cache_key', key)
  }

  private async clearAllFromSupabase(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    await supabase
      .from('pace_cache_pool')
      .delete()
      .neq('cache_key', '') // Delete all
  }
}

// Singleton instance
export const cachePool = new CachePool()

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cachePool.cleanup()
  }, 10 * 60 * 1000)
}

// Cache key generators
export const CacheKeys = {
  LIVE_METRICS: 'qa-metrics:live',
  DAILY_REPORT: (date: string) => `qa-metrics:daily:${date}`,
  ROLLBACK_WINDOWS: (date: string) => `qa-metrics:rollback:${date}`,
  TEAM_STATS: (date: string) => `qa-metrics:team:${date}`,
}
