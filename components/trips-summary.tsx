"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Code,
  Wrench,
  FileText,
  Headphones,
} from "lucide-react"
import { TripsLineChart } from "@/components/pace-line-chart"
import {
  tripsTeams,
  devTeamMembers,
  DEV_2025_MONTHLY_BASELINE,
  type TripsLetterTeam,
  type TripsMemberPace,
  type DevMemberPace,
} from "@/lib/dashboard-data"

const dayOptions = [7, 14, 30] as const
type DayWindow = (typeof dayOptions)[number]

const metricIcons: Record<string, React.ElementType> = {
  T: Zap,
  R: Code,
  I: Wrench,
  P: FileText,
  S: Headphones,
}

const metricColors: Record<string, string> = {
  T: "bg-primary text-primary-foreground",
  R: "bg-chart-3 text-card",
  I: "bg-chart-4 text-card-foreground",
  P: "bg-chart-2 text-card",
  S: "bg-chart-5 text-card",
}

const metricBorderColors: Record<string, string> = {
  T: "border-l-primary",
  R: "border-l-chart-3",
  I: "border-l-chart-4",
  P: "border-l-chart-2",
  S: "border-l-chart-5",
}

// ========================================
// Compute % diff vs 60-day average
// ========================================

function computeDelta(currentPace: number, avg60DailyPace: number, days: number): number | null {
  if (avg60DailyPace <= 0) return null
  const expectedPace = avg60DailyPace * days
  if (expectedPace === 0) return null
  return ((currentPace - expectedPace) / expectedPace) * 100
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null
  const isPositive = delta >= 0
  const Icon = isPositive ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[8px] font-semibold tabular-nums",
        isPositive ? "text-chart-2" : "text-destructive"
      )}
    >
      <Icon className="size-2.5" />
      {isPositive ? "+" : ""}{delta.toFixed(0)}%
    </span>
  )
}

export function TripsSummary() {
  const [days, setDays] = useState<DayWindow>(7)

  // Compute totals per letter
  const letterTotals = tripsTeams.map((team) => {
    const totalPace = team.members.reduce((s, m) => s + m.pace[days], 0)
    const totalSP = team.members.reduce((s, m) => s + m.sp[days], 0)
    const totalTix = team.members.reduce((s, m) => s + m.tickets[days], 0)
    const totalAvg60Daily = team.members.reduce((s, m) => s + m.avg60DailyPace, 0)
    const delta = computeDelta(totalPace, totalAvg60Daily, days)
    return { key: team.key, totalPace, totalSP, totalTix, delta }
  })

  const tripsGrandTotal = letterTotals.reduce((s, l) => s + l.totalPace, 0)
  const devGrandTotal = devTeamMembers.reduce((s, m) => s + m.pace[days], 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Day Window Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">TRIPS Team Pace</h2>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {dayOptions.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Last {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* TRIPS Overview Row - compact totals */}
      <div className="grid grid-cols-5 gap-2">
        {letterTotals.map((lt) => {
          const team = tripsTeams.find((t) => t.key === lt.key)!
          const Icon = metricIcons[lt.key]
          return (
            <Card key={lt.key} className={cn("py-2 px-2.5 gap-0 border-l-3", metricBorderColors[lt.key])}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn("flex items-center justify-center size-5 rounded text-[9px] font-bold", metricColors[lt.key])}>
                  <Icon className="size-3" />
                </span>
                <span className="text-[10px] font-semibold text-foreground truncate">{lt.key}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tabular-nums text-foreground leading-tight">
                  {lt.totalPace.toFixed(1)}
                </span>
                <DeltaBadge delta={lt.delta} />
              </div>
              <span className="text-[9px] text-muted-foreground">{lt.totalSP} SP / {lt.totalTix} tix</span>
            </Card>
          )
        })}
      </div>

      {/* Grand Totals Row */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="py-2 px-3 gap-0 border-l-3 border-l-primary">
          <span className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">TRIPS Total Pace</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums text-foreground leading-tight">
              {tripsGrandTotal.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">SP</span>
            </span>
            <span className="text-[9px] text-muted-foreground">vs 60d avg</span>
            <DeltaBadge
              delta={computeDelta(
                tripsGrandTotal,
                tripsTeams.reduce((s, t) => s + t.members.reduce((a, m) => a + m.avg60DailyPace, 0), 0),
                days
              )}
            />
          </div>
        </Card>
        <Card className="py-2 px-3 gap-0 border-l-3 border-l-chart-2">
          <span className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider">Dev Total Pace</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tabular-nums text-foreground leading-tight">
              {devGrandTotal.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">SP</span>
            </span>
            <DevBaselineBadge pace={devGrandTotal} days={days} members={devTeamMembers.length} />
            <DeltaBadge
              delta={computeDelta(
                devGrandTotal,
                devTeamMembers.reduce((s, m) => s + m.avg60DailyPace, 0),
                days
              )}
            />
          </div>
        </Card>
      </div>

      {/* Two-Column Layout: Pace Tables (left/top) + Chart (right/bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left/Top: Pace Comparison Tables */}
        <div className="flex flex-col gap-2">
          {tripsTeams.map((team) => (
            <LetterPaceTable key={team.key} team={team} days={days} />
          ))}
          {/* Dev Team Table */}
          <DevPaceTable devMembers={devTeamMembers} days={days} />
        </div>

        {/* Right/Bottom: TRIPS Trend Chart */}
        <div className="flex flex-col h-full min-h-[500px]">
          <TripsLineChart />
        </div>
      </div>
    </div>
  )
}

// ========================================
// Dev 2025 Baseline Badge
// ========================================

function DevBaselineBadge({ pace, days, members }: { pace: number; days: DayWindow; members: number }) {
  const baselinePerMember = (DEV_2025_MONTHLY_BASELINE / 30) * days
  const totalBaseline = baselinePerMember * members
  const multiple = pace / totalBaseline

  return (
    <Badge
      className={cn(
        "text-[9px] px-1.5 py-0",
        multiple >= 1 ? "bg-chart-2/15 text-chart-2" : "bg-destructive/15 text-destructive"
      )}
    >
      {multiple.toFixed(2)}x 2025
    </Badge>
  )
}

// ========================================
// Letter Pace Mini Table
// ========================================

function LetterPaceTable({ team, days }: { team: TripsLetterTeam; days: DayWindow }) {
  const Icon = metricIcons[team.key]
  const totalPace = team.members.reduce((s, m) => s + m.pace[days], 0)
  const totalSP = team.members.reduce((s, m) => s + m.sp[days], 0)
  const totalTix = team.members.reduce((s, m) => s + m.tickets[days], 0)
  const totalAvg60Daily = team.members.reduce((s, m) => s + m.avg60DailyPace, 0)
  const totalDelta = computeDelta(totalPace, totalAvg60Daily, days)
  const isTBD = team.members.length === 1 && team.members[0].name === "TBD"

  return (
    <Card className={cn("py-0 px-0 gap-0 overflow-hidden border-l-3", metricBorderColors[team.key])}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <span className={cn("flex items-center justify-center size-5 rounded text-[9px] font-bold", metricColors[team.key])}>
          <Icon className="size-3" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">{team.label}</span>
        <span className="text-[9px] text-muted-foreground ml-auto">{team.fullLabel}</span>
        {isTBD && (
          <Badge className="bg-muted text-muted-foreground text-[8px] px-1.5 py-0">Details Coming</Badge>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/15">
              <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Pace</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">vs 60d Avg</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">SP</th>
              <th className="px-3 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Tickets</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((m, idx) => {
              const delta = computeDelta(m.pace[days], m.avg60DailyPace, days)
              return (
                <tr key={m.name} className={cn(idx < team.members.length - 1 && "border-b border-border/50")}>
                  <td className="px-3 py-1.5 text-[10px] font-medium text-foreground">{m.name}</td>
                  <td className="px-2 py-1.5 text-right text-[10px] tabular-nums font-semibold text-foreground">
                    {m.pace[days].toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <DeltaBadge delta={delta} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
                    {m.sp[days]}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
                    {m.tickets[days]}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/25">
              <td className="px-3 py-1.5 text-[10px] font-bold text-foreground">Total</td>
              <td className="px-2 py-1.5 text-right text-[10px] font-bold tabular-nums text-foreground">
                {totalPace.toFixed(1)}
              </td>
              <td className="px-2 py-1.5 text-right">
                <DeltaBadge delta={totalDelta} />
              </td>
              <td className="px-2 py-1.5 text-right text-[10px] font-bold tabular-nums text-foreground">
                {totalSP}
              </td>
              <td className="px-3 py-1.5 text-right text-[10px] font-bold tabular-nums text-foreground">
                {totalTix}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

// ========================================
// Dev Team Pace Table (with 2025 baseline + 60d avg)
// ========================================

function DevPaceTable({ devMembers, days }: { devMembers: DevMemberPace[]; days: DayWindow }) {
  const totalPace = devMembers.reduce((s, m) => s + m.pace[days], 0)
  const totalSP = devMembers.reduce((s, m) => s + m.sp[days], 0)
  const totalTix = devMembers.reduce((s, m) => s + m.tickets[days], 0)
  const totalAvg60Daily = devMembers.reduce((s, m) => s + m.avg60DailyPace, 0)
  const totalDelta = computeDelta(totalPace, totalAvg60Daily, days)

  const perMemberBaseline = (DEV_2025_MONTHLY_BASELINE / 30) * days

  return (
    <Card className="py-0 px-0 gap-0 overflow-hidden border-l-3 border-l-chart-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-chart-2/5 border-b border-border">
        <span className="flex items-center justify-center size-5 rounded bg-chart-2 text-card text-[9px] font-bold">
          <Activity className="size-3" />
        </span>
        <span className="text-[11px] font-semibold text-foreground">Software Dev Pace</span>
        <span className="text-[9px] text-muted-foreground ml-auto">
          2025 Baseline: {DEV_2025_MONTHLY_BASELINE} SP/mo per dev
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/15">
              <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Developer</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Pace</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">vs 60d Avg</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">SP</th>
              <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Tickets</th>
              <th className="px-3 py-1.5 text-right text-[9px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">x 2025</th>
            </tr>
          </thead>
          <tbody>
            {devMembers.map((m, idx) => {
              const multiple = m.pace[days] / perMemberBaseline
              const delta = computeDelta(m.pace[days], m.avg60DailyPace, days)
              return (
                <tr key={m.name} className={cn(idx < devMembers.length - 1 && "border-b border-border/50")}>
                  <td className="px-3 py-1.5 text-[10px] font-medium text-foreground">{m.name}</td>
                  <td className="px-2 py-1.5 text-right text-[10px] tabular-nums font-semibold text-foreground">
                    {m.pace[days].toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <DeltaBadge delta={delta} />
                  </td>
                  <td className="px-2 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
                    {m.sp[days]}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">
                    {m.tickets[days]}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <Badge
                      className={cn(
                        "text-[9px] px-1.5 py-0",
                        multiple >= 1 ? "bg-chart-2/15 text-chart-2" : "bg-destructive/15 text-destructive"
                      )}
                    >
                      {multiple.toFixed(2)}x
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-chart-2/5">
              <td className="px-3 py-1.5 text-[10px] font-bold text-foreground">Total</td>
              <td className="px-2 py-1.5 text-right text-[10px] font-bold tabular-nums text-foreground">
                {totalPace.toFixed(1)}
              </td>
              <td className="px-2 py-1.5 text-right">
                <DeltaBadge delta={totalDelta} />
              </td>
              <td className="px-2 py-1.5 text-right text-[10px] font-bold tabular-nums text-foreground">
                {totalSP}
              </td>
              <td className="px-2 py-1.5 text-right text-[10px] font-bold tabular-nums text-foreground">
                {totalTix}
              </td>
              <td className="px-3 py-1.5 text-right">
                <DevBaselineBadge pace={totalPace} days={days} members={devMembers.length} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}
