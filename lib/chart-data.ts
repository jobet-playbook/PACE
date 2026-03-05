// ============================================================
// Time-series chart data generation for PACE dashboards
// ============================================================

export type TimeWindow = "daily" | "weekly" | "monthly"
export type DateRange = "1m" | "3m" | "1y"

export interface ChartDataPoint {
  date: string
  label: string
  spThroughput: number
  pace: number
  cycleTime: number
  volume: number
  returnRate: number
  [key: string]: string | number
}

// Seeded pseudo-random for reproducible data
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function formatDate(d: Date): string {
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`
}

function formatWeek(d: Date): string {
  return `W${getWeekNumber(d)} ${formatDate(d)}`
}

function formatMonth(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[d.getMonth()]} '${d.getFullYear().toString().slice(2)}`
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d.getTime() - start.getTime()
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

// Base values for each dashboard type
const baseValues: Record<string, { spThroughput: number; pace: number; cycleTime: number; volume: number; returnRate: number }> = {
  qa: { spThroughput: 19, pace: 9.6, cycleTime: 6.5, volume: 5.4, returnRate: 37 },
  documentation: { spThroughput: 12.7, pace: 6.5, cycleTime: 4.5, volume: 3.1, returnRate: 30 },
  "code-review": { spThroughput: 15.4, pace: 7.8, cycleTime: 3.3, volume: 4.1, returnRate: 24 },
}

// Per-member multipliers (relative to team base)
const memberMultipliers: Record<string, number> = {
  "Clive Nys": 1.15,
  "Jordan Beebe": 0.85,
  "Mike Del Signore": 0.70,
  "Joey Stapleton": 0.95,
  "Davi Chaves": 1.05,
  "charlson": 0.55,
  "Corbin Schmeil": 0.65,
  "Sushanth Suresh Kumar": 0.60,
}

function getIntervals(range: DateRange, window: TimeWindow): { dates: Date[]; labeler: (d: Date) => string } {
  const end = new Date(2026, 1, 23) // Feb 23, 2026
  const dates: Date[] = []

  let count: number
  let stepDays: number

  if (window === "daily") {
    stepDays = 1
    count = range === "1m" ? 22 : range === "3m" ? 65 : 260
  } else if (window === "weekly") {
    stepDays = 7
    count = range === "1m" ? 4 : range === "3m" ? 12 : 52
  } else {
    stepDays = 30
    count = range === "1m" ? 1 : range === "3m" ? 3 : 12
  }

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i * stepDays)
    dates.push(d)
  }

  const labeler = window === "daily" ? formatDate : window === "weekly" ? formatWeek : formatMonth
  return { dates, labeler }
}

export function generateChartData(
  dashboardType: string,
  range: DateRange,
  window: TimeWindow,
  memberFilter: string
): ChartDataPoint[] {
  const base = baseValues[dashboardType] ?? baseValues.qa
  const { dates, labeler } = getIntervals(range, window)
  const mult = memberFilter !== "all" ? (memberMultipliers[memberFilter] ?? 0.75) : 1

  // Scale up aggregation for weekly/monthly
  const aggScale = window === "daily" ? 1 : window === "weekly" ? 5 : 22

  const rand = seededRandom(
    dashboardType.length * 1000 +
    (memberFilter === "all" ? 999 : memberFilter.length * 31) +
    (range === "1m" ? 1 : range === "3m" ? 2 : 3)
  )

  return dates.map((d, idx) => {
    // Add a slight upward trend over time + noise
    const trendFactor = 1 + (idx / dates.length) * 0.15
    const noise = () => 0.75 + rand() * 0.5

    const spThroughput = Math.round(base.spThroughput * mult * aggScale * trendFactor * noise())
    const pace = Math.round(base.pace * mult * aggScale * trendFactor * noise() * 10) / 10
    const cycleTime = Math.round(base.cycleTime * (1 - (idx / dates.length) * 0.08) * noise() * 10) / 10
    const volume = Math.round(base.volume * mult * aggScale * trendFactor * noise())
    const returnRate = Math.round(base.returnRate * noise())

    return {
      date: d.toISOString(),
      label: labeler(d),
      spThroughput,
      pace,
      cycleTime,
      volume,
      returnRate,
    }
  })
}

// TRIPS-level chart data: each series is a TRIPS letter
export interface TripsChartDataPoint {
  date: string
  label: string
  T: number
  R: number
  I: number
  P: number
  S: number
  Dev: number
}

export function generateTripsChartData(
  range: DateRange,
  window: TimeWindow,
  metric: "pace" | "spThroughput" | "cycleTime" | "volume"
): TripsChartDataPoint[] {
  const { dates, labeler } = getIntervals(range, window)
  const aggScale = window === "daily" ? 1 : window === "weekly" ? 5 : 22

  const tripsBase: Record<string, number> = {
    T: metric === "pace" ? 4.8 : metric === "spThroughput" ? 9.4 : metric === "cycleTime" ? 6.5 : 2.8,
    R: metric === "pace" ? 3.9 : metric === "spThroughput" ? 7.8 : metric === "cycleTime" ? 3.2 : 2.2,
    I: metric === "pace" ? 1.2 : metric === "spThroughput" ? 2.4 : metric === "cycleTime" ? 9.5 : 0.8,
    P: metric === "pace" ? 3.2 : metric === "spThroughput" ? 6.4 : metric === "cycleTime" ? 4.5 : 1.8,
    S: metric === "pace" ? 1.9 : metric === "spThroughput" ? 3.6 : metric === "cycleTime" ? 2.0 : 1.4,
    Dev: metric === "pace" ? 8.3 : metric === "spThroughput" ? 16.4 : metric === "cycleTime" ? 3.6 : 5.2,
  }

  const rand = seededRandom(metric.length * 100 + (range === "1m" ? 10 : range === "3m" ? 20 : 30))

  return dates.map((d, idx) => {
    const trend = 1 + (idx / dates.length) * 0.12
    const noise = () => 0.8 + rand() * 0.4
    const scale = metric === "cycleTime" ? 1 : aggScale

    return {
      date: d.toISOString(),
      label: labeler(d),
      T: Math.round(tripsBase.T * scale * trend * noise() * 10) / 10,
      R: Math.round(tripsBase.R * scale * trend * noise() * 10) / 10,
      I: Math.round(tripsBase.I * scale * trend * noise() * 10) / 10,
      P: Math.round(tripsBase.P * scale * trend * noise() * 10) / 10,
      S: Math.round(tripsBase.S * scale * trend * noise() * 10) / 10,
      Dev: Math.round(tripsBase.Dev * scale * trend * noise() * 10) / 10,
    }
  })
}

export async function getChartData(dashboardType: string, member?: string) {
  const range: DateRange = "3m"
  const window: TimeWindow = "daily"
  const memberFilter = member || "all"
  
  return generateChartData(dashboardType, range, window, memberFilter)
}
