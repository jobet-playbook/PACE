"use client"

import { useState, useMemo } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MetricCard, MetricValue } from "@/components/metric-card"
import { TicketTable } from "@/components/ticket-table"
import { TeamDailyPerformance, IndividualPerformance } from "@/components/daily-performance"
import { PaceLineChart } from "@/components/pace-line-chart"
import { AIInsights } from "@/components/ai-insights"
import { EscapedBugsTable } from "@/components/escaped-bugs"
import type { SnapshotMetrics, Ticket, TeamMemberPerformance, AIInsight, EscapedBug } from "@/lib/dashboard-data"
import { Filter, BarChart3, Users, User, AlertCircle, Sparkles, ShieldAlert } from "lucide-react"

interface PaceDashboardTabProps {
  label: string
  dashboardType: string
  metrics: SnapshotMetrics
  criticalTickets: Ticket[]
  agingTickets: Ticket[]
  dailyPerformance: {
    today: { date: string; tickets: number; sp: number; firstPass: number; firstPassSP: number; repeatPass: number; repeatPassSP: number }
    previous: { date: string; tickets: number; sp: number; firstPass: number; firstPassSP: number; repeatPass: number; repeatPassSP: number }
    last30BD: { tickets: number; sp: number; firstPass: number; repeatPass: number; repeatPassSP: number }
  }
  teamMembers: TeamMemberPerformance[]
  allMembers: string[]
  allStatuses: string[]
  throughputLabel?: string
  paceLabel?: string
  volumeLabel?: string
  qCycleLabel?: string
  tCycleLabel?: string
  rAgeLabel?: string
  defectsLabel?: string
  critBugsLabel?: string
  performanceTitle?: string
  critTableTitle?: string
  agingTableTitle?: string
  agingThreshold?: string
  aiInsights?: AIInsight[]
  escapedBugs?: EscapedBug[]
  showEscapedBugs?: boolean
}

export function PaceDashboardTab({
  label,
  dashboardType,
  metrics,
  criticalTickets,
  agingTickets,
  dailyPerformance: perfData,
  teamMembers,
  allMembers,
  allStatuses,
  throughputLabel = "SP Throughput",
  paceLabel,
  volumeLabel,
  qCycleLabel = "Q-Cycle",
  tCycleLabel = "T-Cycle Time (To Done)",
  rAgeLabel,
  defectsLabel = "[Beta] Escaped Defects (Last 7 Days)",
  critBugsLabel = "Crit Bugs (Last 7 Days)",
  performanceTitle,
  critTableTitle = "Critical Tickets",
  agingTableTitle,
  agingThreshold = "Age > 3 BD",
  aiInsights = [],
  escapedBugs = [],
  showEscapedBugs = false,
}: PaceDashboardTabProps) {
  const [filterMember, setFilterMember] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  const finalPaceLabel = paceLabel ?? `${label} PACE`
  const finalVolumeLabel = volumeLabel ?? `Assigned to ${label} Volume (Last 7 Days)`
  const finalRageLabel = rAgeLabel ?? `R-Age Cycle Time (${label} Pushback)`
  const finalPerfTitle = performanceTitle ?? `Daily ${label} Performance`
  const finalAgingTitle = agingTableTitle ?? `Aging in ${label} (${agingThreshold})`

  const filteredCritical = useMemo(() => {
    if (!criticalTickets || !Array.isArray(criticalTickets)) return []
    return criticalTickets.filter(t => {
      if (filterMember !== "all" && t.assignee !== filterMember) return false
      if (filterStatus !== "all" && t.status !== filterStatus) return false
      return true
    })
  }, [criticalTickets, filterMember, filterStatus])

  const filteredAging = useMemo(() => {
    if (!agingTickets || !Array.isArray(agingTickets)) return []
    return agingTickets.filter(t => {
      if (filterMember !== "all" && t.assignee !== filterMember) return false
      if (filterStatus !== "all" && t.status !== filterStatus) return false
      return true
    })
  }, [agingTickets, filterMember, filterStatus])

  const totalIssues = filteredCritical.length + filteredAging.length

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-card border border-border px-3 py-2.5">
        <Filter className="size-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Filters</span>
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="h-7 w-[180px] text-[11px]">
            <SelectValue placeholder="Team Member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Team Members</SelectItem>
            {allMembers.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-7 w-[160px] text-[11px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {allStatuses.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterMember !== "all" || filterStatus !== "all") && (
          <button
            className="text-[11px] text-primary hover:text-primary/80 font-medium underline underline-offset-2"
            onClick={() => { setFilterMember("all"); setFilterStatus("all") }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Inner Subtabs */}
      <Tabs defaultValue="team" className="gap-3">
        <TabsList className="h-8 bg-muted/50">
          <TabsTrigger value="team" className="gap-1 px-3 text-[11px]">
            <Users className="size-3" />
            <span>Team Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="individual" className="gap-1 px-3 text-[11px]">
            <User className="size-3" />
            <span>Individual Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-1 px-3 text-[11px]">
            <AlertCircle className="size-3" />
            <span>Issues</span>
            {totalIssues > 0 && (
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                {totalIssues}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="gap-1 px-3 text-[11px]">
            <Sparkles className="size-3" />
            <span>AI Insights</span>
            {aiInsights.length > 0 && (
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-chart-2 text-card text-[8px] font-bold">
                {aiInsights.length}
              </span>
            )}
          </TabsTrigger>
          {showEscapedBugs && (
            <TabsTrigger value="escaped-bugs" className="gap-1 px-3 text-[11px]">
              <ShieldAlert className="size-3" />
              <span>Escaped Bugs</span>
              {escapedBugs.length > 0 && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                  {escapedBugs.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ==================== TEAM METRICS ==================== */}
        <TabsContent value="team">
          <div className="flex flex-col gap-4">
            {/* Snapshot Cards */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 className="size-3.5 text-primary" />
                <h2 className="text-xs font-semibold text-foreground">{"Today's Snapshot"}</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <MetricCard title={throughputLabel}>
                  <MetricValue label="Last 7 Days" value={`${metrics.spThroughput.last7} SP`} delta={metrics.spThroughput.last7Delta} prior={metrics.spThroughput.prior7} />
                  <MetricValue label="Last 28 Days" value={`${metrics.spThroughput.last28} SP`} delta={metrics.spThroughput.last28Delta} prior={metrics.spThroughput.prior28} />
                </MetricCard>

                <MetricCard title={finalPaceLabel}>
                  <MetricValue label="Last 7 Days" value={`${metrics.pace.last7} SP`} />
                  <MetricValue label="Last 28 Days" value={`${metrics.pace.last28} SP`} />
                </MetricCard>

                <MetricCard title={finalVolumeLabel}>
                  <MetricValue label="Total Tickets" value={`${metrics.assignedVolume.totalTickets} Tix`} />
                  <MetricValue label="Total SP" value={`${metrics.assignedVolume.totalSP} SP`} />
                </MetricCard>

                <MetricCard title={qCycleLabel} accentLabel={`To ${label}`}>
                  <MetricValue label="7d" value={metrics.qCycle.last7} unit="bd" small />
                  <MetricValue label="28d" value={metrics.qCycle.last28} unit="bd" small />
                </MetricCard>

                <MetricCard title={tCycleLabel}>
                  <MetricValue label="7d" value={metrics.tCycle.last7 ?? "---"} unit={metrics.tCycle.last7 ? "bd" : undefined} small />
                  <MetricValue label="28d" value={metrics.tCycle.last28} unit="bd" small />
                </MetricCard>

                <MetricCard title={finalRageLabel}>
                  <MetricValue label="7d" value={metrics.rAgeCycle.last7} unit="bd" small />
                  <MetricValue label="28d" value={metrics.rAgeCycle.last28} unit="bd" small />
                </MetricCard>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <MetricCard title={defectsLabel}>
                  <MetricValue label="" value={metrics.escapedDefects} />
                </MetricCard>
                <MetricCard title={critBugsLabel}>
                  <MetricValue label="Open" value={metrics.critBugs.open} className={metrics.critBugs.open > 0 ? "text-destructive" : ""} />
                  <MetricValue label="Resolved" value={metrics.critBugs.resolved} />
                </MetricCard>
              </div>
            </div>

            {/* Trend Chart */}
            <PaceLineChart dashboardType={dashboardType} allMembers={allMembers} />

            {/* Team Daily Performance + Leaderboard */}
            <TeamDailyPerformance
              teamData={perfData}
              members={teamMembers}
              title={finalPerfTitle}
            />
          </div>
        </TabsContent>

        {/* ==================== INDIVIDUAL METRICS ==================== */}
        <TabsContent value="individual">
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-primary px-3 py-2">
              <h3 className="text-xs font-semibold text-primary-foreground">Individual Breakdown</h3>
            </div>
            <IndividualPerformance
              members={teamMembers}
              todayDate={perfData.today.date}
              filterMember={filterMember}
            />
          </div>
        </TabsContent>

        {/* ==================== ISSUES ==================== */}
        <TabsContent value="issues">
          <div className="flex flex-col gap-4">
            {filteredCritical.length === 0 && filteredAging.length === 0 ? (
              <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
                No issues found matching the current filters.
              </div>
            ) : (
              <>
                <TicketTable tickets={filteredCritical} title={critTableTitle} variant="critical" />
                <TicketTable tickets={filteredAging} title={finalAgingTitle} variant="aging" />
              </>
            )}
          </div>
        </TabsContent>

        {/* ==================== AI INSIGHTS ==================== */}
        <TabsContent value="ai-insights">
          <AIInsights insights={aiInsights} filterMember={filterMember} />
        </TabsContent>

        {/* ==================== ESCAPED BUGS (QA only) ==================== */}
        {showEscapedBugs && (
          <TabsContent value="escaped-bugs">
            <EscapedBugsTable bugs={escapedBugs} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
