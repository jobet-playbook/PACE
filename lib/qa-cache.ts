// Shared in-memory cache for QA metrics
// This works in Vercel's serverless environment because all API routes
// in the same deployment share the same Node.js process instance

export let qaMetricsCache: any = null
export let cacheTimestamp: number = 0

export function setQAMetricsCache(data: any) {
  qaMetricsCache = data
  cacheTimestamp = Date.now()
}

export function getQAMetricsCache() {
  return qaMetricsCache
}

export function getCacheTimestamp() {
  return cacheTimestamp
}

export function clearQAMetricsCache() {
  qaMetricsCache = null
  cacheTimestamp = 0
}
