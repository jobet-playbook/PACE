"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Clock, AlertTriangle, Trophy, TrendingUp } from "lucide-react"
import type { TeamMemberPerformance } from "@/lib/dashboard-data"

type LeaderboardPeriod = "daily" | "weekly" | "monthly"

interface TeamDailyPerformanceProps {
  teamData: {
    today: { date: string; tickets: number; sp: number; firstPass: number; firstPassSP: number; repeatPass: number; repeatPassSP: number }
    previous: { date: string; tickets: number; sp: number; firstPass: number; firstPassSP: number; repeatPass: number; repeatPassSP: number }
    last30BD: { tickets: number; sp: number; firstPass: number; repeatPass: number; repeatPassSP: number }
  }
  members: TeamMemberPerformance[]
  title: string
}

export function TeamDailyPerformance({ teamData, members, title }: TeamDailyPerformanceProps) {
  const [lbPeriod, setLbPeriod] = useState<LeaderboardPeriod>("daily")

  const getSortedMembers = () => {
    return [...members].sort((a, b) => {
      if (lbPeriod === "daily") return b.today.sp - a.today.sp
      if (lbPeriod === "weekly") return b.weekly.sp - a.weekly.sp
      return b.monthly.sp - a.monthly.sp
    })
  }

  const sorted = getSortedMembers()

  const getPeriodData = (m: TeamMemberPerformance) => {
    if (lbPeriod === "daily") return { tickets: m.today.tickets, sp: m.today.sp, firstPass: m.today.firstPass, repeatPass: m.today.repeatPass }
    if (lbPeriod === "weekly") return { tickets: m.weekly.tickets, sp: m.weekly.sp, firstPass: m.weekly.firstPass, repeatPass: m.weekly.repeatPass }
    return { tickets: m.monthly.tickets, sp: m.monthly.sp, firstPass: m.monthly.firstPass, repeatPass: m.monthly.repeatPass }
  }

  const periodLabels: Record<LeaderboardPeriod, string> = { daily: "Today", weekly: "This Week", monthly: "This Month" }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-lg bg-primary px-3 py-2">
        <h3 className="text-xs font-semibold text-primary-foreground">{title}</h3>
      </div>

      {/* Team Totals */}
      <Card className="gap-2 py-3 px-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Team Totals</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatBlock
            label={`Today (${teamData.today.date})`}
            tickets={teamData.today.tickets}
            sp={teamData.today.sp}
            firstPass={teamData.today.firstPass}
            firstPassSP={teamData.today.firstPassSP}
            repeatPass={teamData.today.repeatPass}
            repeatPassSP={teamData.today.repeatPassSP}
          />
          <StatBlock
            label={`Prev (${teamData.previous.date})`}
            tickets={teamData.previous.tickets}
            sp={teamData.previous.sp}
            firstPass={teamData.previous.firstPass}
            firstPassSP={teamData.previous.firstPassSP}
            repeatPass={teamData.previous.repeatPass}
            repeatPassSP={teamData.previous.repeatPassSP}
          />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-muted-foreground">Last 30 BD</span>
            <p className="text-base font-bold text-foreground">
              {teamData.last30BD.tickets} <span className="text-muted-foreground font-normal text-xs">Tix</span>{" / "}
              {teamData.last30BD.sp} <span className="text-muted-foreground font-normal text-xs">SP</span>
            </p>
            <p className="text-[10px] text-chart-2">{"First Pass: "}{teamData.last30BD.firstPass}</p>
            <p className="text-[10px] text-primary">{"Repeat Pass: "}{teamData.last30BD.repeatPass} ({teamData.last30BD.repeatPassSP} SP)</p>
          </div>
        </div>
      </Card>

      {/* Leaderboard */}
      <Card className="gap-2 py-3 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy className="size-3 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Leaderboard ({periodLabels[lbPeriod]} by SP)
            </p>
          </div>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {(["daily", "weekly", "monthly"] as LeaderboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setLbPeriod(p)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-medium transition-colors capitalize",
                  lbPeriod === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {sorted.map((member, i) => {
            const d = getPeriodData(member)
            return (
              <div
                key={member.name}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2",
                  i === 0 && d.sp > 0 ? "bg-accent" : "bg-muted/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "flex items-center justify-center size-5 rounded-full text-[10px] font-bold",
                    i === 0 && d.sp > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-foreground">{member.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs tabular-nums text-muted-foreground">{d.tickets} Tix</span>
                  <span className="text-xs font-bold tabular-nums text-foreground">{d.sp} SP</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-chart-2">FP: {d.firstPass}</span>
                    <span className="text-primary">RP: {d.repeatPass}</span>
                  </div>
                  {lbPeriod !== "daily" && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {"Avg Cycle: "}
                      {lbPeriod === "weekly" ? member.weekly.avgCycleTime : member.monthly.avgCycleTime}
                      {" bd"}
                    </span>
                  )}
                  {lbPeriod === "daily" && member.today.churn > 0 && (
                    <span className="text-[10px] text-muted-foreground">Churn: {member.today.churn}%</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ============================================
// Individual Performance Component
// ============================================

interface IndividualPerformanceProps {
  members: TeamMemberPerformance[]
  todayDate: string
  filterMember: string
}

export function IndividualPerformance({ members, todayDate, filterMember }: IndividualPerformanceProps) {
  const filteredMembers = filterMember === "all" ? members : members.filter(m => m.name === filterMember)

  if (filteredMembers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No individual data available for the selected filter.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredMembers.map(member => (
          <Card key={member.name} className="gap-2 py-3 px-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">{member.name}</p>
              {member.today.churn > 0 && (
                <span className="text-[9px] text-muted-foreground rounded bg-muted px-1.5 py-0.5">Churn: {member.today.churn}%</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[9px] text-muted-foreground">Today</span>
                <p className="text-[11px] font-semibold text-foreground">{member.today.tickets} Tix | {member.today.sp} SP</p>
                <p className="text-[9px] text-chart-2">FP: {member.today.firstPass} ({member.today.firstPassSP} SP)</p>
                <p className="text-[9px] text-primary">RP: {member.today.repeatPass} ({member.today.repeatPassSP} SP)</p>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">This Week</span>
                <p className="text-[11px] font-semibold text-foreground">{member.weekly.tickets} Tix | {member.weekly.sp} SP</p>
                <p className="text-[9px] text-chart-2">FP: {member.weekly.firstPass}</p>
                <p className="text-[9px] text-primary">RP: {member.weekly.repeatPass}</p>
                <p className="text-[9px] text-muted-foreground">Cycle: {member.weekly.avgCycleTime} bd</p>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">This Month</span>
                <p className="text-[11px] font-semibold text-foreground">{member.monthly.tickets} Tix | {member.monthly.sp} SP</p>
                <p className="text-[9px] text-chart-2">FP: {member.monthly.firstPass}</p>
                <p className="text-[9px] text-primary">RP: {member.monthly.repeatPass}</p>
                <p className="text-[9px] text-muted-foreground">Cycle: {member.monthly.avgCycleTime} bd</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Detailed activity feeds */}
      {filteredMembers.map(member => (
        <Card key={member.name} className="gap-3 py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-primary" />
              <p className="text-sm font-semibold text-foreground">{member.name}</p>
            </div>
            {member.dailyRhythm.toLowerCase().includes("inactiv") && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-1">
                <AlertTriangle className="size-3" />
                Inactive Period
              </Badge>
            )}
          </div>

          {/* Daily Rhythm */}
          <div className="rounded-md border-l-2 border-primary bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Daily Rhythm</p>
            <p className="text-xs text-foreground leading-relaxed">{member.dailyRhythm}</p>
          </div>

          {/* Activities */}
          {member.activities.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                {"Activity: "}{todayDate}
              </p>
              {member.activities.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-md bg-muted/20 px-3 py-2">
                  <Clock className="mt-0.5 size-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-primary">{activity.ticketKey}</span>
                      <span className="text-[10px] text-muted-foreground">{activity.sp} pts</span>
                      <Badge className={cn(
                        "text-[9px] px-1.5 py-0",
                        activity.type.includes("First") ? "bg-chart-2 text-card" : "bg-primary text-primary-foreground"
                      )}>
                        {activity.type}
                      </Badge>
                      <span className="ml-auto text-[10px] text-muted-foreground">{activity.time}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">{activity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {member.activities.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No activity recorded for today.</p>
          )}
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Shared StatBlock
// ============================================

function StatBlock({
  label,
  tickets,
  sp,
  firstPass,
  firstPassSP,
  repeatPass,
  repeatPassSP,
}: {
  label: string
  tickets: number
  sp: number
  firstPass: number
  firstPassSP: number
  repeatPass: number
  repeatPassSP: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
      <p className="text-base font-bold text-foreground">
        {tickets} <span className="text-muted-foreground font-normal text-xs">Tix</span>
        {" / "}
        {sp} <span className="text-muted-foreground font-normal text-xs">SP</span>
      </p>
      <p className="text-[10px] text-chart-2">{"First Pass: "}{firstPass} ({firstPassSP} SP)</p>
      <p className="text-[10px] text-primary">{"Repeat Pass: "}{repeatPass} ({repeatPassSP} SP)</p>
    </div>
  )
}
