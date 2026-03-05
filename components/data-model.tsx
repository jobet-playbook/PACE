"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Database, Code, FileJson, Table, Layers, ChevronRight } from "lucide-react"

interface FieldDef {
  name: string
  type: string
  description: string
  required?: boolean
}

interface InterfaceDef {
  name: string
  description: string
  fields: FieldDef[]
  usedIn: string[]
}

const interfaces: InterfaceDef[] = [
  {
    name: "Ticket",
    description: "Represents a ticket in the system (critical, aging, etc.)",
    usedIn: ["criticalTickets", "agingTickets", "docCriticalTickets", "crCriticalTickets"],
    fields: [
      { name: "key", type: "string", description: "Ticket ID (e.g., PBSCR-9894)", required: true },
      { name: "recentAge", type: "number", description: "Days since last QA action", required: true },
      { name: "age", type: "number", description: "Total age in days", required: true },
      { name: "sp", type: "number | null", description: "Story points", required: false },
      { name: "assignee", type: "string", description: "Person assigned to ticket", required: true },
      { name: "developer", type: "string", description: "Developer who worked on it", required: true },
      { name: "returnCount", type: "number", description: "Number of QA returns", required: true },
      { name: "firstQA", type: "string", description: "Date of first QA (MM/DD/YY)", required: true },
      { name: "latestQA", type: "string", description: "Date of latest QA action", required: true },
      { name: "status", type: "string", description: "Current status (QA, Push Staging, etc.)", required: true },
      { name: "summary", type: "string", description: "Ticket summary/title", required: true },
    ],
  },
  {
    name: "SnapshotMetrics",
    description: "Snapshot metrics for dashboard cards (throughput, pace, cycle times)",
    usedIn: ["qaSnapshotMetrics", "docSnapshotMetrics", "crSnapshotMetrics"],
    fields: [
      { name: "spThroughput", type: "{ last7, last7Delta, last28, last28Delta, prior7, prior28 }", description: "SP throughput with deltas", required: true },
      { name: "pace", type: "{ last7, last28 }", description: "Pace values for 7 and 28 days", required: true },
      { name: "assignedVolume", type: "{ totalTickets, totalSP, agingOver7 }", description: "Volume metrics", required: true },
      { name: "qCycle", type: "{ last7, last28 }", description: "Q-Cycle times in business days", required: true },
      { name: "tCycle", type: "{ last7, last28 }", description: "T-Cycle time to done", required: true },
      { name: "rAgeCycle", type: "{ last7, last28 }", description: "R-Age pushback cycle time", required: true },
      { name: "escapedDefects", type: "number", description: "Count of escaped defects", required: true },
      { name: "critBugs", type: "{ open, resolved }", description: "Critical bugs counts", required: true },
    ],
  },
  {
    name: "TeamMemberPerformance",
    description: "Individual team member performance data",
    usedIn: ["teamMemberPerformance", "docTeamMemberPerformance", "crTeamMemberPerformance"],
    fields: [
      { name: "name", type: "string", description: "Team member name", required: true },
      { name: "today", type: "{ tickets, sp, firstPass, firstPassSP, repeatPass, repeatPassSP, churn }", description: "Today's performance", required: true },
      { name: "previousDay", type: "{ ... }", description: "Previous day performance (same shape as today)", required: true },
      { name: "weekly", type: "LeaderboardPeriod", description: "Weekly aggregated metrics", required: true },
      { name: "monthly", type: "LeaderboardPeriod", description: "Monthly aggregated metrics", required: true },
      { name: "dailyRhythm", type: "string", description: "AI-generated daily rhythm summary", required: true },
      { name: "activities", type: "Activity[]", description: "List of activities for the day", required: true },
    ],
  },
  {
    name: "LeaderboardPeriod",
    description: "Aggregated metrics for leaderboard (daily/weekly/monthly)",
    usedIn: ["TeamMemberPerformance.weekly", "TeamMemberPerformance.monthly"],
    fields: [
      { name: "tickets", type: "number", description: "Total tickets completed", required: true },
      { name: "sp", type: "number", description: "Total story points", required: true },
      { name: "firstPass", type: "number", description: "First pass count", required: true },
      { name: "repeatPass", type: "number", description: "Repeat pass count", required: true },
      { name: "avgCycleTime", type: "number", description: "Average cycle time in days", required: true },
    ],
  },
  {
    name: "BugAnalysisEntry",
    description: "Bug analysis with attribution and penalties",
    usedIn: ["bugAnalysisData"],
    fields: [
      { name: "id", type: "string", description: "Bug ID (BUG-001, etc.)", required: true },
      { name: "ticketKey", type: "string", description: "Related ticket key", required: true },
      { name: "summary", type: "string", description: "Bug summary", required: true },
      { name: "severity", type: "'Critical' | 'Semi-Critical'", description: "Bug severity level", required: true },
      { name: "impactScore", type: "number", description: "Impact score 1-10", required: true },
      { name: "causedByDev", type: "string", description: "Developer who caused the bug", required: true },
      { name: "causedByCodeReviewer", type: "string", description: "Code reviewer who missed it", required: true },
      { name: "causedByQA", type: "string", description: "QA who missed it", required: true },
      { name: "datePushed", type: "string", description: "Date code was pushed", required: true },
      { name: "dateDiscovered", type: "string", description: "Date bug was discovered", required: true },
      { name: "qaPacePenalty", type: "number", description: "SP penalty for QA (negative)", required: true },
      { name: "crPacePenalty", type: "number", description: "SP penalty for CR (negative)", required: true },
      { name: "lessonsLearned", type: "string", description: "Lessons learned text", required: true },
    ],
  },
  {
    name: "AIInsight",
    description: "AI-generated insights for process improvement",
    usedIn: ["qaAIInsights", "docAIInsights", "crAIInsights"],
    fields: [
      { name: "id", type: "string", description: "Insight ID", required: true },
      { name: "person", type: "string", description: "Person the insight relates to", required: true },
      { name: "category", type: "InsightCause", description: "Category of insight", required: true },
      { name: "severity", type: "'High' | 'Medium' | 'Low'", description: "Severity level", required: true },
      { name: "insight", type: "string", description: "The insight text", required: true },
      { name: "recommendation", type: "string", description: "AI recommendation", required: true },
      { name: "detectedDate", type: "string", description: "Date insight was detected", required: true },
      { name: "relatedTickets", type: "string[]", description: "Related ticket keys", required: true },
    ],
  },
  {
    name: "EscapedBug",
    description: "Escaped bug with full attribution chain",
    usedIn: ["escapedBugsData"],
    fields: [
      { name: "id", type: "string", description: "Escaped bug ID", required: true },
      { name: "ticketKey", type: "string", description: "Related ticket key", required: true },
      { name: "severity", type: "BugSeverity", description: "Bug severity", required: true },
      { name: "environment", type: "'Production' | 'Staging' | 'Beta'", description: "Where it was found", required: true },
      { name: "escapedFrom", type: "'QA' | 'Code Review' | 'Both'", description: "Which gate it escaped", required: true },
      { name: "qaOwner", type: "string", description: "QA person responsible", required: true },
      { name: "codeReviewer", type: "string", description: "Code reviewer responsible", required: true },
      { name: "developer", type: "string", description: "Developer who wrote the code", required: true },
      { name: "daysToDetect", type: "number", description: "Days from push to discovery", required: true },
      { name: "rootCause", type: "string", description: "Root cause analysis", required: true },
      { name: "customerImpact", type: "string", description: "Impact on customers", required: true },
    ],
  },
  {
    name: "TripsMemberPace",
    description: "TRIPS team member pace data with 60-day baseline",
    usedIn: ["tripsTeams[].members"],
    fields: [
      { name: "name", type: "string", description: "Team member name", required: true },
      { name: "pace", type: "Record<7|14|30, number>", description: "Pace by time window", required: true },
      { name: "sp", type: "Record<7|14|30, number>", description: "SP by time window", required: true },
      { name: "tickets", type: "Record<7|14|30, number>", description: "Tickets by time window", required: true },
      { name: "avg60DailyPace", type: "number", description: "60-day average daily pace for comparison", required: true },
    ],
  },
  {
    name: "DevMemberPace",
    description: "Developer pace data with 2025 baseline comparison",
    usedIn: ["devTeamMembers"],
    fields: [
      { name: "name", type: "string", description: "Developer name", required: true },
      { name: "pace", type: "Record<7|14|30, number>", description: "Pace by time window", required: true },
      { name: "sp", type: "Record<7|14|30, number>", description: "SP by time window", required: true },
      { name: "tickets", type: "Record<7|14|30, number>", description: "Tickets by time window", required: true },
      { name: "avg60DailyPace", type: "number", description: "60-day average daily pace", required: true },
    ],
  },
]

const dataExports = [
  { name: "qaSnapshotMetrics", type: "SnapshotMetrics", category: "QA" },
  { name: "criticalTickets", type: "Ticket[]", category: "QA" },
  { name: "agingTickets", type: "Ticket[]", category: "QA" },
  { name: "dailyPerformance", type: "DailyPerformance", category: "QA" },
  { name: "teamMemberPerformance", type: "TeamMemberPerformance[]", category: "QA" },
  { name: "allTeamMembers", type: "string[]", category: "QA" },
  { name: "allStatuses", type: "string[]", category: "QA" },
  { name: "bugAnalysisData", type: "BugAnalysisEntry[]", category: "QA" },
  { name: "qaAIInsights", type: "AIInsight[]", category: "QA" },
  { name: "escapedBugsData", type: "EscapedBug[]", category: "QA" },
  { name: "docSnapshotMetrics", type: "SnapshotMetrics", category: "Documentation" },
  { name: "docCriticalTickets", type: "Ticket[]", category: "Documentation" },
  { name: "docAgingTickets", type: "Ticket[]", category: "Documentation" },
  { name: "docTeamMemberPerformance", type: "TeamMemberPerformance[]", category: "Documentation" },
  { name: "docAIInsights", type: "AIInsight[]", category: "Documentation" },
  { name: "crSnapshotMetrics", type: "SnapshotMetrics", category: "Code Review" },
  { name: "crCriticalTickets", type: "Ticket[]", category: "Code Review" },
  { name: "crAgingTickets", type: "Ticket[]", category: "Code Review" },
  { name: "crTeamMemberPerformance", type: "TeamMemberPerformance[]", category: "Code Review" },
  { name: "crAIInsights", type: "AIInsight[]", category: "Code Review" },
  { name: "tripsTeams", type: "TripsLetterTeam[]", category: "TRIPS" },
  { name: "devTeamMembers", type: "DevMemberPace[]", category: "TRIPS" },
  { name: "DEV_2025_MONTHLY_BASELINE", type: "number (200)", category: "TRIPS" },
]

export function DataModel() {
  const [selectedInterface, setSelectedInterface] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-chart-3 to-primary px-4 py-3">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-card" />
          <h2 className="text-sm font-semibold text-card">Data Model Reference</h2>
        </div>
        <p className="text-[11px] text-card/80 mt-1">
          Documentation for developers to understand and map data correctly
        </p>
      </div>

      <Tabs defaultValue="interfaces" className="gap-3">
        <TabsList className="h-8 bg-muted/50">
          <TabsTrigger value="interfaces" className="gap-1 px-3 text-[11px]">
            <Code className="size-3" />
            <span>Interfaces</span>
          </TabsTrigger>
          <TabsTrigger value="exports" className="gap-1 px-3 text-[11px]">
            <FileJson className="size-3" />
            <span>Data Exports</span>
          </TabsTrigger>
          <TabsTrigger value="relationships" className="gap-1 px-3 text-[11px]">
            <Layers className="size-3" />
            <span>Relationships</span>
          </TabsTrigger>
        </TabsList>

        {/* Interfaces Tab */}
        <TabsContent value="interfaces">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {interfaces.map(iface => (
              <Card 
                key={iface.name} 
                className={cn(
                  "py-0 px-0 gap-0 overflow-hidden cursor-pointer transition-all",
                  selectedInterface === iface.name ? "ring-2 ring-primary" : "hover:border-primary/50"
                )}
                onClick={() => setSelectedInterface(selectedInterface === iface.name ? null : iface.name)}
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                  <Table className="size-3.5 text-primary" />
                  <span className="text-[11px] font-mono font-semibold text-foreground">{iface.name}</span>
                  <ChevronRight className={cn(
                    "size-3 text-muted-foreground ml-auto transition-transform",
                    selectedInterface === iface.name && "rotate-90"
                  )} />
                </div>

                {/* Description */}
                <div className="px-3 py-2 border-b border-border/50">
                  <p className="text-[10px] text-muted-foreground">{iface.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {iface.usedIn.map(u => (
                      <Badge key={u} variant="outline" className="text-[8px] px-1 py-0 font-mono">
                        {u}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Fields (expanded) */}
                {selectedInterface === iface.name && (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/15 border-b border-border">
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-muted-foreground uppercase">Field</th>
                          <th className="px-2 py-1.5 text-left text-[9px] font-semibold text-muted-foreground uppercase">Type</th>
                          <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-muted-foreground uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {iface.fields.map((field, idx) => (
                          <tr key={field.name} className={cn(idx < iface.fields.length - 1 && "border-b border-border/50")}>
                            <td className="px-3 py-1.5 text-[10px] font-mono font-medium text-foreground">
                              {field.name}
                              {field.required && <span className="text-destructive ml-0.5">*</span>}
                            </td>
                            <td className="px-2 py-1.5 text-[9px] font-mono text-chart-3">{field.type}</td>
                            <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{field.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Data Exports Tab */}
        <TabsContent value="exports">
          <Card className="py-0 px-0 gap-0 overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b border-border">
              <span className="text-[11px] font-semibold text-foreground">Exported Data from lib/dashboard-data.ts</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/15 border-b border-border">
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Export Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {dataExports.map((exp, idx) => (
                    <tr key={exp.name} className={cn(idx < dataExports.length - 1 && "border-b border-border/50")}>
                      <td className="px-3 py-2 text-[11px] font-mono font-medium text-primary">{exp.name}</td>
                      <td className="px-3 py-2 text-[10px] font-mono text-chart-3">{exp.type}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn(
                          "text-[9px] px-1.5 py-0",
                          exp.category === "QA" ? "border-primary text-primary" :
                          exp.category === "Documentation" ? "border-chart-2 text-chart-2" :
                          exp.category === "Code Review" ? "border-chart-3 text-chart-3" :
                          "border-chart-4 text-chart-4"
                        )}>
                          {exp.category}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Relationships Tab */}
        <TabsContent value="relationships">
          <div className="flex flex-col gap-3">
            <Card className="py-3 px-4 gap-2">
              <h3 className="text-[11px] font-semibold text-foreground">Data Flow</h3>
              <div className="text-[10px] text-muted-foreground space-y-2">
                <p><span className="font-mono text-primary">page.tsx</span> imports from <span className="font-mono text-chart-3">lib/dashboard-data.ts</span> and passes to <span className="font-mono text-primary">PaceDashboardTab</span></p>
                <p><span className="font-mono text-primary">PaceDashboardTab</span> renders <span className="font-mono text-chart-3">MetricCard</span>, <span className="font-mono text-chart-3">TicketTable</span>, <span className="font-mono text-chart-3">DailyPerformance</span>, <span className="font-mono text-chart-3">AIInsights</span>, <span className="font-mono text-chart-3">EscapedBugsTable</span></p>
                <p><span className="font-mono text-primary">TripsSummary</span> uses <span className="font-mono text-chart-3">tripsTeams</span>, <span className="font-mono text-chart-3">devTeamMembers</span>, and <span className="font-mono text-chart-3">DEV_2025_MONTHLY_BASELINE</span></p>
              </div>
            </Card>

            <Card className="py-3 px-4 gap-2">
              <h3 className="text-[11px] font-semibold text-foreground">Key Relationships</h3>
              <ul className="text-[10px] text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <ChevronRight className="size-2.5 text-primary" />
                  <span><span className="font-mono text-foreground">Ticket.assignee</span> links to <span className="font-mono text-foreground">TeamMemberPerformance.name</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="size-2.5 text-primary" />
                  <span><span className="font-mono text-foreground">BugAnalysisEntry.ticketKey</span> references <span className="font-mono text-foreground">Ticket.key</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="size-2.5 text-primary" />
                  <span><span className="font-mono text-foreground">AIInsight.person</span> links to <span className="font-mono text-foreground">TeamMemberPerformance.name</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="size-2.5 text-primary" />
                  <span><span className="font-mono text-foreground">EscapedBug.qaOwner/codeReviewer/developer</span> link to team members</span>
                </li>
                <li className="flex items-center gap-2">
                  <ChevronRight className="size-2.5 text-primary" />
                  <span><span className="font-mono text-foreground">TripsMemberPace.avg60DailyPace</span> used to compute % vs 60-day average</span>
                </li>
              </ul>
            </Card>

            <Card className="py-3 px-4 gap-2">
              <h3 className="text-[11px] font-semibold text-foreground">TRIPS Acronym Mapping</h3>
              <div className="grid grid-cols-5 gap-2 mt-1">
                {[
                  { letter: "T", name: "Testing/QA", data: "tripsTeams[0]" },
                  { letter: "R", name: "Code Review", data: "tripsTeams[1]" },
                  { letter: "I", name: "Infrastructure", data: "tripsTeams[2]" },
                  { letter: "P", name: "PRD/Docs", data: "tripsTeams[3]" },
                  { letter: "S", name: "Support", data: "tripsTeams[4]" },
                ].map(t => (
                  <div key={t.letter} className="text-center">
                    <span className="text-lg font-bold text-primary">{t.letter}</span>
                    <p className="text-[9px] text-foreground font-medium">{t.name}</p>
                    <p className="text-[8px] font-mono text-muted-foreground">{t.data}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
