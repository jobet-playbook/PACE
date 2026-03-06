# Cache Pool System Documentation

## 🎯 Overview

The Cache Pool is a **multi-layer caching system** designed to combat Jira API rate limiting and dramatically improve UI performance.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  REQUEST FLOW                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Dashboard Request                                   │
│     ↓                                                   │
│  2. Check Memory Cache (instant - 0ms)                  │
│     ├─ HIT → Return immediately ✅                      │
│     └─ MISS → Continue                                  │
│                                                         │
│  3. Check Supabase Cache (fast - ~50ms)                 │
│     ├─ HIT → Return + populate memory ✅                │
│     └─ MISS → Continue                                  │
│                                                         │
│  4. Fetch from Jira API (slow - 2-3s)                   │
│     ├─ SUCCESS → Cache + return ✅                      │
│     └─ RATE LIMITED (429) → Fallback                    │
│                                                         │
│  5. Fallback: Stale Cache (up to 24h old)              │
│     ├─ FOUND → Return with warning ⚠️                   │
│     └─ NOT FOUND → Error ❌                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 📊 Performance Comparison

| Scenario | Without Cache | With Cache Pool |
|----------|---------------|-----------------|
| **First Load** | 2-3 seconds | 2-3 seconds |
| **Subsequent Loads** | 2-3 seconds | **<100ms** ⚡ |
| **Rate Limited** | Error 429 ❌ | Stale cache ✅ |
| **Server Restart** | Lost cache | Persisted ✅ |
| **Multi-instance** | Separate caches | Shared cache ✅ |

## 🚀 Setup

### Step 1: Add Cache Table to Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Cache pool table (already in schema.sql)
CREATE TABLE pace_cache_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pace_cache_pool_key ON pace_cache_pool(cache_key);
CREATE INDEX idx_pace_cache_pool_cached_at ON pace_cache_pool(cached_at DESC);
```

### Step 2: Environment Variables

Already configured if you have Supabase set up:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Warm the Cache (Optional)

After daily sync, warm the cache for instant dashboard loads:

```bash
curl -X POST "https://your-app.vercel.app/api/cache/warm" \
  -H "Authorization: Bearer your_cron_secret"
```

## 🔧 API Endpoints

### 1. Live Metrics (Auto-cached)

```bash
GET /api/qa-metrics/live
```

**Response includes cache metadata:**
```json
{
  "output": { ... },
  "rollback_windows": { ... },
  "_cached": true,
  "_source": "cache_pool",
  "_cacheAge": 45
}
```

**Cache sources:**
- `jira_api` - Fresh from Jira
- `cache_pool` - From cache (memory or Supabase)
- `stale_cache` - Fallback when rate limited

### 2. Cache Warming

```bash
POST /api/cache/warm
Authorization: Bearer your_cron_secret
```

**Use cases:**
- After daily sync to pre-populate cache
- Before high-traffic periods
- Manual refresh when needed

### 3. Cache Status

```bash
GET /api/cache/warm
```

**Response:**
```json
{
  "cacheStats": {
    "totalEntries": 5,
    "validEntries": 3,
    "expiredEntries": 2,
    "oldestEntry": 3600,
    "newestEntry": 45
  },
  "liveCacheExists": true,
  "message": "Cache is warm"
}
```

## ⚙️ Configuration

### Cache TTL Settings

Edit `lib/cache-pool.ts`:

```typescript
private readonly DEFAULT_TTL = 5 * 60 * 1000      // 5 minutes (fresh)
private readonly STALE_TTL = 24 * 60 * 60 * 1000  // 24 hours (fallback)
```

**Recommendations:**
- **Development:** 1-2 minutes for faster testing
- **Production:** 5-10 minutes for balance
- **Low-activity:** 15-30 minutes to reduce API calls

### Cache Keys

Defined in `lib/cache-pool.ts`:

```typescript
export const CacheKeys = {
  LIVE_METRICS: 'qa-metrics:live',
  DAILY_REPORT: (date: string) => `qa-metrics:daily:${date}`,
  ROLLBACK_WINDOWS: (date: string) => `qa-metrics:rollback:${date}`,
  TEAM_STATS: (date: string) => `qa-metrics:team:${date}`,
}
```

## 🔄 Automatic Cache Management

### Memory Cleanup

Runs every 10 minutes automatically:
- Removes expired entries
- Frees up memory
- Logs cleanup activity

### Cache Invalidation

Cache is automatically refreshed when:
- TTL expires (5 minutes)
- Manual cache warm triggered
- Daily sync completes

## 🛡️ Rate Limit Protection

### How It Works

1. **Normal Operation:**
   - Request → Cache (if valid) → Return
   - Request → Jira API → Cache → Return

2. **Rate Limited (429 Error):**
   - Request → Jira API → **429 Error**
   - Fallback → Stale Cache (up to 24h) → Return with warning
   - User sees data (slightly old) instead of error

3. **Response Indicators:**
   ```json
   {
     "_cached": true,
     "_stale": true,
     "_rateLimited": true,
     "_source": "stale_cache"
   }
   ```

### Best Practices

1. **Monitor rate limits:**
   - Check Jira API usage in Atlassian admin
   - Set up alerts for 429 errors

2. **Optimize sync schedule:**
   - Daily sync at 6 AM (low traffic)
   - Cache warming after sync
   - Avoid multiple simultaneous requests

3. **Use cache warming:**
   - Pre-populate cache before business hours
   - Reduce cold starts

## 📈 Monitoring

### Check Cache Health

```bash
# Get cache statistics
curl https://your-app.vercel.app/api/cache/warm

# Response shows:
# - Total cached entries
# - Valid vs expired entries
# - Cache age (oldest/newest)
```

### Logs to Watch

```bash
# Cache hits (good!)
💾 [Cache] Memory hit for qa-metrics:live (age: 45s)
💾 [Cache] Supabase hit for qa-metrics:live

# Cache misses (expected on first load)
📊 [Live] Cache miss, fetching from Jira...

# Rate limit fallback (warning)
⚠️ [Live] Rate limit detected, attempting stale cache fallback...
⚠️ [Cache] Using stale cache (age: 3600s)

# Cleanup (maintenance)
🧹 [Cache] Cleaned 3 expired entries
```

## 🎯 Integration with Daily Sync

### Recommended Workflow

```yaml
# vercel.json
{
  "crons": [
    {
      "path": "/api/qa-metrics/sync",
      "schedule": "0 6 * * *"  # 6 AM EST daily
    },
    {
      "path": "/api/cache/warm",
      "schedule": "5 6 * * *"  # 6:05 AM EST (after sync)
    }
  ]
}
```

**Flow:**
1. **6:00 AM** - Daily sync runs, stores in Supabase
2. **6:05 AM** - Cache warm runs, populates cache pool
3. **All day** - Dashboard reads from cache (instant!)
4. **Next day** - Repeat

## 🔍 Troubleshooting

### Cache Not Working

**Check:**
1. Supabase credentials configured?
2. `pace_cache_pool` table exists?
3. Service role key has permissions?

**Test:**
```bash
# Check if cache table exists
SELECT * FROM pace_cache_pool LIMIT 1;
```

### Still Getting Rate Limited

**Solutions:**
1. Increase cache TTL to 10-15 minutes
2. Add cache warming to cron schedule
3. Reduce number of manual refreshes
4. Check Jira API quota in Atlassian admin

### Stale Data Showing

**Expected behavior when:**
- Rate limited (shows warning)
- Cache warming hasn't run yet
- Sync failed but cache exists

**Fix:**
```bash
# Force fresh data
curl -X POST "https://your-app.vercel.app/api/cache/warm" \
  -H "Authorization: Bearer your_cron_secret"
```

### Cache Growing Too Large

**Monitor:**
```bash
# Check Supabase storage
SELECT cache_key, pg_size_pretty(pg_column_size(data)) as size
FROM pace_cache_pool
ORDER BY pg_column_size(data) DESC;
```

**Cleanup old entries:**
```sql
-- Delete cache older than 7 days
DELETE FROM pace_cache_pool
WHERE cached_at < NOW() - INTERVAL '7 days';
```

## 💡 Advanced Usage

### Custom Cache Keys

```typescript
import { cachePool } from '@/lib/cache-pool'

// Store custom data
await cachePool.set('my-custom-key', myData, 10 * 60 * 1000) // 10 min TTL

// Retrieve
const data = await cachePool.get('my-custom-key')

// Clear specific key
await cachePool.clear('my-custom-key')

// Clear all cache
await cachePool.clearAll()
```

### Programmatic Cache Warming

```typescript
import { cachePool, CacheKeys } from '@/lib/cache-pool'

// In your sync endpoint
const freshData = await fetchFromJira()
await cachePool.set(CacheKeys.LIVE_METRICS, freshData)
```

## 📊 Benefits Summary

✅ **Performance:** 20-30x faster dashboard loads  
✅ **Reliability:** No more 429 errors for users  
✅ **Persistence:** Cache survives server restarts  
✅ **Scalability:** Shared cache across instances  
✅ **Fallback:** Graceful degradation on errors  
✅ **Monitoring:** Built-in stats and logging  

---

**Questions?** Check the logs for detailed cache activity or review `lib/cache-pool.ts` for implementation details.
