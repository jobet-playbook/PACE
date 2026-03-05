"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { generateChartData, generateTripsChartData, type DateRange, type TimeWindow } from "@/lib/chart-data"
import { Calendar, Clock, TrendingUp } from "lucide-react"

// ============================================================
// Pace Tab Line Chart (QA / Docs / Code Review)
// ============================================================

const metricSeriesConfig = [
  { key: "spThroughput", label: "SP Throughput", color: "var(--color-chart-1)" },
  { key: "pace", label: "Pace", color: "var(--color-chart-2)" },
  { key: "cycleTime", label: "Cycle Time", color: "var(--color-chart-3)" },
  { key: "volume", label: "Volume", color: "var(--color-chart-4)" },
  { key: "returnRate", label: "Return Rate %", color: "var(--color-chart-5)" },
]

interface PaceLineChartProps {
  dashboardType: string
  allMembers: string[]
}

export function PaceLineChart({ dashboardType, allMembers }: PaceLineChartProps) {
  const [range, setRange] = useState<DateRange>("3m")
  const [window, setWindow] = useState<TimeWindow>("weekly")
  const [member, setMember] = useState("all")
  const [activeSeries, setActiveSeries] = useState<string[]>(["spThroughput", "pace"])

  const data = useMemo(
    () => generateChartData(dashboardType, range, window, member),
    [dashboardType, range, window, member]
  )

  const toggleSeries = (key: string) => {
    setActiveSeries(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
    )
  }

  return (
    <Card className="gap-0 py-3 px-3">
      {/* Chart Header + Filters */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Trend Analysis</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3 text-muted-foreground" />
            <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <SelectTrigger className="h-7 w-[110px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last 1 Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground" />
            <Select value={window} onValueChange={(v) => setWindow(v as TimeWindow)}>
              <SelectTrigger className="h-7 w-[100px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={member} onValueChange={setMember}>
            <SelectTrigger className="h-7 w-[160px] text-[11px]">
              <SelectValue placeholder="Team Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {allMembers.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Series Toggles */}
        <div className="flex flex-wrap gap-1.5">
          {metricSeriesConfig.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: activeSeries.includes(s.key) ? s.color + "22" : "var(--color-muted)",
                color: activeSeries.includes(s.key) ? s.color : "var(--color-muted-foreground)",
                border: `1px solid ${activeSeries.includes(s.key) ? s.color : "var(--color-border)"}`,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: activeSeries.includes(s.key) ? s.color : "var(--color-muted-foreground)" }}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "var(--color-card)",
                borderColor: "var(--color-border)",
                borderRadius: 6,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10 }}
              iconType="plainline"
              iconSize={12}
            />
            {metricSeriesConfig
              .filter(s => activeSeries.includes(s.key))
              .map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ============================================================
// TRIPS Summary Line Chart
// ============================================================

const tripsSeriesConfig = [
  { key: "T", label: "T - Testing", color: "var(--color-chart-1)" },
  { key: "R", label: "R - Review", color: "var(--color-chart-3)" },
  { key: "I", label: "I - Infra", color: "var(--color-chart-4)" },
  { key: "P", label: "P - PRD/Docs", color: "var(--color-chart-2)" },
  { key: "S", label: "S - Support", color: "var(--color-chart-5)" },
  { key: "Dev", label: "Dev Pace", color: "#666" },
]

export function TripsLineChart() {
  const [range, setRange] = useState<DateRange>("3m")
  const [window, setWindow] = useState<TimeWindow>("weekly")
  const [metric, setMetric] = useState<"pace" | "spThroughput" | "cycleTime" | "volume">("pace")
  const [activeSeries, setActiveSeries] = useState<string[]>(["T", "R", "P", "Dev"])

  const data = useMemo(
    () => generateTripsChartData(range, window, metric),
    [range, window, metric]
  )

  const toggleSeries = (key: string) => {
    setActiveSeries(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
    )
  }

  return (
    <Card className="gap-0 py-3 px-3">
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">TRIPS Trend Analysis</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3 text-muted-foreground" />
            <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <SelectTrigger className="h-7 w-[110px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last 1 Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground" />
            <Select value={window} onValueChange={(v) => setWindow(v as TimeWindow)}>
              <SelectTrigger className="h-7 w-[100px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <SelectTrigger className="h-7 w-[130px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pace">Pace (SP)</SelectItem>
              <SelectItem value="spThroughput">SP Throughput</SelectItem>
              <SelectItem value="cycleTime">Cycle Time (bd)</SelectItem>
              <SelectItem value="volume">Volume (Tix)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {tripsSeriesConfig.map(s => (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: activeSeries.includes(s.key) ? s.color + "22" : "var(--color-muted)",
                color: activeSeries.includes(s.key) ? s.color : "var(--color-muted-foreground)",
                border: `1px solid ${activeSeries.includes(s.key) ? s.color : "var(--color-border)"}`,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: activeSeries.includes(s.key) ? s.color : "var(--color-muted-foreground)" }}
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                backgroundColor: "var(--color-card)",
                borderColor: "var(--color-border)",
                borderRadius: 6,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10 }}
              iconType="plainline"
              iconSize={12}
            />
            {tripsSeriesConfig
              .filter(s => activeSeries.includes(s.key))
              .map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={s.key === "Dev" ? 2.5 : 1.5}
                  strokeDasharray={s.key === "Dev" ? "6 3" : undefined}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
