"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PaceDashboardTab } from "@/components/pace-dashboard"
import {
  qaSnapshotMetrics,
  criticalTickets,
  agingTickets,
  dailyPerformance,
  teamMemberPerformance,
  allTeamMembers,
  allStatuses,
  docSnapshotMetrics,
  docCriticalTickets,
  docAgingTickets,
  docDailyPerformance,
  docTeamMemberPerformance,
  docAllStatuses,
  crSnapshotMetrics,
  crCriticalTickets,
  crAgingTickets,
  crDailyPerformance,
  crTeamMemberPerformance,
  crAllStatuses,
  qaAIInsights,
  docAIInsights,
  crAIInsights,
  escapedBugsData,
} from "@/lib/dashboard-data"
import { TripsSummary } from "@/components/trips-summary"
import { DataModel } from "@/components/data-model"
import { InfrastructureDashboard } from "@/components/infrastructure-dashboard"
import { SupportDashboard } from "@/components/support-dashboard"
import { ClientKnowledgeDashboard } from "@/components/client-knowledge-dashboard"
import { ShieldCheck, FileText, GitPullRequest, Layers, Database, Server, Headphones, BookOpen } from "lucide-react"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4 lg:px-8">
        <div className="mx-auto max-w-[1400px] flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">PACE Dashboard</h1>
            <p className="text-xs text-muted-foreground">TRIPS Performance Tracking - Testing, Review, Infrastructure, PRD, Support</p>
          </div>
          <span className="ml-auto rounded bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            February 23, 2026
          </span>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <Tabs defaultValue="trips" className="gap-4">
          <TabsList className="h-10">
            <TabsTrigger value="trips" className="gap-1.5 px-4">
              <Layers className="size-3.5" />
              <span>TRIPS Summary</span>
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-1.5 px-4">
              <ShieldCheck className="size-3.5" />
              <span>T - Testing / QA</span>
            </TabsTrigger>
            <TabsTrigger value="documentation" className="gap-1.5 px-4">
              <FileText className="size-3.5" />
              <span>P - PRD / Docs</span>
            </TabsTrigger>
            <TabsTrigger value="code-review" className="gap-1.5 px-4">
              <GitPullRequest className="size-3.5" />
              <span>R - Code Review</span>
            </TabsTrigger>
            <TabsTrigger value="infrastructure" className="gap-1.5 px-4">
              <Server className="size-3.5" />
              <span>I - Infrastructure</span>
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5 px-4">
              <Headphones className="size-3.5" />
              <span>S - Support</span>
            </TabsTrigger>
            <TabsTrigger value="client-md" className="gap-1.5 px-4">
              <BookOpen className="size-3.5" />
              <span>Client.MD</span>
            </TabsTrigger>
            <TabsTrigger value="data-model" className="gap-1.5 px-4">
              <Database className="size-3.5" />
              <span>Data Model</span>
            </TabsTrigger>
          </TabsList>

          {/* TRIPS Summary Tab */}
          <TabsContent value="trips">
            <TripsSummary />
          </TabsContent>

          {/* QA PACE Tab */}
          <TabsContent value="qa">
            <PaceDashboardTab
              label="QA"
              dashboardType="qa"
              metrics={qaSnapshotMetrics}
              criticalTickets={criticalTickets}
              agingTickets={agingTickets}
              dailyPerformance={dailyPerformance}
              teamMembers={teamMemberPerformance}
              allMembers={allTeamMembers}
              allStatuses={allStatuses}
              paceLabel="QA PACE"
              volumeLabel="Assigned to QA Volume (Last 7 Days)"
              qCycleLabel="Q-Cycle (To Q.A)"
              rAgeLabel="R-Age Cycle Time (QA Pushback)"
              performanceTitle="Daily QA Performance"
              agingTableTitle="Aging in QA (Age > 3 BD)"
              aiInsights={qaAIInsights}
              escapedBugs={escapedBugsData}
              showEscapedBugs={true}
            />
          </TabsContent>

          {/* Documentation PACE Tab */}
          <TabsContent value="documentation">
            <PaceDashboardTab
              label="Documentation"
              dashboardType="documentation"
              metrics={docSnapshotMetrics}
              criticalTickets={docCriticalTickets}
              agingTickets={docAgingTickets}
              dailyPerformance={docDailyPerformance}
              teamMembers={docTeamMemberPerformance}
              allMembers={["Jordan Beebe", "Mike Del Signore", "Joey Stapleton", "charlson", "Corbin Schmeil"]}
              allStatuses={docAllStatuses}
              paceLabel="Documentation PACE"
              volumeLabel="Assigned to Documentation Volume (Last 7 Days)"
              qCycleLabel="D-Cycle (To Documentation)"
              tCycleLabel="T-Cycle Time (To Ready for Dev)"
              rAgeLabel="R-Age Cycle Time (Doc Pushback)"
              defectsLabel="[Beta] Doc Gaps Identified (Last 7 Days)"
              critBugsLabel="Critical Doc Issues (Last 7 Days)"
              performanceTitle="Daily Documentation Performance"
              critTableTitle="Critical Documentation Tickets"
              agingTableTitle="Aging in Documentation (Age > 3 BD)"
              aiInsights={docAIInsights}
            />
          </TabsContent>

          {/* Code Review PACE Tab */}
          <TabsContent value="code-review">
            <PaceDashboardTab
              label="Code Review"
              dashboardType="code-review"
              metrics={crSnapshotMetrics}
              criticalTickets={crCriticalTickets}
              agingTickets={crAgingTickets}
              dailyPerformance={crDailyPerformance}
              teamMembers={crTeamMemberPerformance}
              allMembers={["Davi Chaves", "Joey Stapleton", "Mike Del Signore", "Jordan Beebe"]}
              allStatuses={crAllStatuses}
              paceLabel="Code Review PACE"
              volumeLabel="Assigned to Code Review Volume (Last 7 Days)"
              qCycleLabel="CR-Cycle (To Code Review)"
              tCycleLabel="T-Cycle Time (To Ready for Dev)"
              rAgeLabel="R-Age Cycle Time (CR Pushback)"
              defectsLabel="[Beta] Code Quality Issues (Last 7 Days)"
              critBugsLabel="Critical CR Blockers (Last 7 Days)"
              performanceTitle="Daily Code Review Performance"
              critTableTitle="Critical Code Review Tickets"
              agingTableTitle="Aging in Code Review (Age > 3 BD)"
              aiInsights={crAIInsights}
            />
          </TabsContent>

          {/* Infrastructure Tab */}
          <TabsContent value="infrastructure">
            <InfrastructureDashboard />
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <SupportDashboard />
          </TabsContent>

          {/* Client.MD Tab */}
          <TabsContent value="client-md">
            <ClientKnowledgeDashboard />
          </TabsContent>

          {/* Data Model Tab */}
          <TabsContent value="data-model">
            <DataModel />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
