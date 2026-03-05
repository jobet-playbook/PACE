"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  supportIssuesData,
  supportMemberStats,
  supportPaceSummary,
} from "@/lib/dashboard-data"
import type { SupportIssue, SupportPriority, SupportStatus } from "@/lib/dashboard-data"
import {
  Headphones,
  HelpCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Trophy,
  XCircle,
  Hourglass,
} from "lucide-react"
import { cn } from "@/lib/utils"

const timeWindows = [
  { value: "7", label: "Last 7 Days" },
  { value: "14", label: "Last 14 Days" },
  { value: "30", label: "Last 30 Days" },
]

const priorityColors: Record<SupportPriority, string> = {
  Critical: "bg-destructive text-destructive-foreground",
  High: "bg-chart-5 text-card",
  Medium: "bg-chart-4 text-card",
  Low: "bg-muted text-muted-foreground",
}

const statusColors: Record<SupportStatus, string> = {
  Resolved: "border-chart-2 text-chart-2",
  Open: "border-destructive text-destructive",
  "In Progress": "border-chart-4 text-chart-4",
  "Pending Client": "border-muted-foreground text-muted-foreground",
}

function StatusIcon({ status }: { status: SupportStatus }) {
  switch (status) {
    case "Resolved":
      return <CheckCircle className="size-3 text-chart-2" />
    case "Open":
      return <XCircle className="size-3 text-destructive" />
    case "In Progress":
      return <Hourglass className="size-3 text-chart-4" />
    case "Pending Client":
      return <Clock className="size-3 text-muted-foreground" />
  }
}

export function SupportDashboard() {
  const [timeWindow, setTimeWindow] = useState("7")
  const [filterAssignee, setFilterAssignee] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")

  const paceSummary = timeWindow === "7"
    ? supportPaceSummary.last7Days
    : timeWindow === "14"
      ? supportPaceSummary.last14Days
      : supportPaceSummary.last30Days

  const allAssignees = useMemo(() => {
    return Array.from(new Set(supportIssuesData.map((i) => i.assignee))).sort()
  }, [])

  const filteredIssues = useMemo(() => {
    return supportIssuesData.filter((issue) => {
      if (filterAssignee !== "all" && issue.assignee !== filterAssignee) return false
      if (filterStatus !== "all" && issue.status !== filterStatus) return false
      if (filterPriority !== "all" && issue.priority !== filterPriority) return false
      // Filter by time window
      const openedDate = new Date(issue.dateOpened.replace(/(\d{2})\/(\d{2})\/(\d{2})/, "20$3-$1-$2"))
      const daysAgo = Math.floor((Date.now() - openedDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysAgo <= parseInt(timeWindow)
    })
  }, [filterAssignee, filterStatus, filterPriority, timeWindow])

  const unresolvedIssues = filteredIssues.filter((i) => i.status !== "Resolved")
  const over24HourIssues = filteredIssues.filter((i) => i.exceeds24Hours)

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* Header with Tooltip */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-chart-5 text-card">
              <Headphones className="size-3.5" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Support Pace Dashboard</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center justify-center rounded-full bg-muted p-1 hover:bg-muted/80">
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs p-3 text-xs">
                <p className="font-semibold mb-1.5">How Support Pace is Calculated:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="size-3 mt-0.5 text-chart-2 shrink-0" />
                    <span><strong>Weighted Issues:</strong> Each issue has a 1-10 weight based on complexity and impact</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="size-3 mt-0.5 text-chart-2 shrink-0" />
                    <span><strong>Pace = Sum of Weights:</strong> Total weighted score of fully resolved issues</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <AlertTriangle className="size-3 mt-0.5 text-destructive shrink-0" />
                    <span><strong>24h Threshold:</strong> Issues exceeding 24 hours to resolve are flagged</span>
                  </li>
                </ul>
                <p className="mt-2 text-muted-foreground">Higher weight = more complex issue. Track resolution time to maintain SLA compliance.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={timeWindow} onValueChange={setTimeWindow}>
            <SelectTrigger className="h-7 w-[140px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeWindows.map((tw) => (
                <SelectItem key={tw.value} value={tw.value}>
                  {tw.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pace Summary Cards */}
        <div className="grid grid-cols-5 gap-2">
          <Card className="py-2 px-2.5 gap-0 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Weighted Pace</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{paceSummary.totalWeightedPace}</p>
          </Card>
          <Card className="py-2 px-2.5 gap-0 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Issues Solved</p>
            <p className="text-lg font-bold text-chart-2 tabular-nums">{paceSummary.issuesSolved}</p>
          </Card>
          <Card className="py-2 px-2.5 gap-0 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Avg Resolution</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{paceSummary.avgResolutionHours}h</p>
          </Card>
          <Card className="py-2 px-2.5 gap-0 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Over 24h</p>
            <p className={cn("text-lg font-bold tabular-nums", paceSummary.over24HourCount > 0 ? "text-destructive" : "text-chart-2")}>
              {paceSummary.over24HourCount}
            </p>
          </Card>
          <Card className="py-2 px-2.5 gap-0 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Open Issues</p>
            <p className={cn("text-lg font-bold tabular-nums", paceSummary.openIssues > 3 ? "text-chart-5" : "text-foreground")}>
              {paceSummary.openIssues}
            </p>
          </Card>
        </div>

        {/* Subtabs */}
        <Tabs defaultValue="team" className="gap-3">
          <TabsList className="h-8">
            <TabsTrigger value="team" className="gap-1 px-3 text-[11px]">
              <Users className="size-3" />
              <span>Team Performance</span>
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-1 px-3 text-[11px]">
              <Headphones className="size-3" />
              <span>All Issues</span>
              <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground text-[8px] font-bold">
                {filteredIssues.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="unresolved" className="gap-1 px-3 text-[11px]">
              <XCircle className="size-3" />
              <span>Unresolved</span>
              {unresolvedIssues.length > 0 && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                  {unresolvedIssues.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="over24h" className="gap-1 px-3 text-[11px]">
              <Clock className="size-3" />
              <span>Over 24h</span>
              {over24HourIssues.length > 0 && (
                <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-chart-5 text-card text-[8px] font-bold">
                  {over24HourIssues.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Team Performance Tab */}
          <TabsContent value="team">
            <Card className="py-2.5 px-3 gap-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Trophy className="size-3 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Support Team Leaderboard
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[9px] h-7 font-semibold">Team Member</TableHead>
                    <TableHead className="text-[9px] h-7 font-semibold text-center">Issues Solved</TableHead>
                    <TableHead className="text-[9px] h-7 font-semibold text-center">Weighted Pace</TableHead>
                    <TableHead className="text-[9px] h-7 font-semibold text-center">Avg Resolution</TableHead>
                    <TableHead className="text-[9px] h-7 font-semibold text-center">Over 24h</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supportMemberStats
                    .slice()
                    .sort((a, b) => b.weightedPace - a.weightedPace)
                    .map((member, idx) => (
                      <TableRow key={member.name} className="hover:bg-muted/30">
                        <TableCell className="text-[10px] py-1.5 font-medium">
                          <div className="flex items-center gap-1.5">
                            {idx === 0 && <Trophy className="size-3 text-chart-4" />}
                            {member.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-center tabular-nums font-semibold">
                          {member.issuesSolved}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-center tabular-nums font-bold text-primary">
                          {member.weightedPace}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-center tabular-nums">
                          {member.avgResolutionHours > 0 ? `${member.avgResolutionHours}h` : "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-center tabular-nums">
                          <span className={cn("font-semibold", member.over24HourCount > 0 ? "text-destructive" : "text-chart-2")}>
                            {member.over24HourCount}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* All Issues Tab */}
          <TabsContent value="issues">
            <IssuesTable
              issues={filteredIssues}
              title="All Support Issues"
              filterAssignee={filterAssignee}
              setFilterAssignee={setFilterAssignee}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterPriority={filterPriority}
              setFilterPriority={setFilterPriority}
              allAssignees={allAssignees}
            />
          </TabsContent>

          {/* Unresolved Tab */}
          <TabsContent value="unresolved">
            <IssuesTable
              issues={unresolvedIssues}
              title="Unresolved Issues"
              filterAssignee={filterAssignee}
              setFilterAssignee={setFilterAssignee}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterPriority={filterPriority}
              setFilterPriority={setFilterPriority}
              allAssignees={allAssignees}
            />
          </TabsContent>

          {/* Over 24h Tab */}
          <TabsContent value="over24h">
            <IssuesTable
              issues={over24HourIssues}
              title="Issues Exceeding 24 Hour Resolution"
              filterAssignee={filterAssignee}
              setFilterAssignee={setFilterAssignee}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterPriority={filterPriority}
              setFilterPriority={setFilterPriority}
              allAssignees={allAssignees}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

interface IssuesTableProps {
  issues: SupportIssue[]
  title: string
  filterAssignee: string
  setFilterAssignee: (v: string) => void
  filterStatus: string
  setFilterStatus: (v: string) => void
  filterPriority: string
  setFilterPriority: (v: string) => void
  allAssignees: string[]
}

function IssuesTable({
  issues,
  title,
  filterAssignee,
  setFilterAssignee,
  filterStatus,
  setFilterStatus,
  filterPriority,
  setFilterPriority,
  allAssignees,
}: IssuesTableProps) {
  return (
    <Card className="py-2.5 px-3 gap-0">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title} ({issues.length})
        </p>
        <div className="flex items-center gap-2">
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-6 w-[130px] text-[10px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {allAssignees.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-6 w-[120px] text-[10px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Pending Client">Pending Client</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-6 w-[100px] text-[10px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[9px] h-7 font-semibold">ID</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold">Client</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold">Summary</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold text-center">Priority</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold text-center">Weight</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold text-center">Status</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold">Assignee</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold">Opened</TableHead>
              <TableHead className="text-[9px] h-7 font-semibold text-center">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.id} className={cn("hover:bg-muted/30", issue.exceeds24Hours && "bg-destructive/5")}>
                <TableCell className="text-[10px] py-1.5 font-medium text-primary">{issue.id}</TableCell>
                <TableCell className="text-[10px] py-1.5 font-medium">{issue.clientName}</TableCell>
                <TableCell className="text-[10px] py-1.5 max-w-[200px] truncate" title={issue.summary}>
                  {issue.summary}
                </TableCell>
                <TableCell className="text-[10px] py-1.5 text-center">
                  <Badge className={cn("text-[8px] px-1.5 py-0", priorityColors[issue.priority])}>
                    {issue.priority}
                  </Badge>
                </TableCell>
                <TableCell className="text-[10px] py-1.5 text-center font-bold tabular-nums">{issue.weight}</TableCell>
                <TableCell className="text-[10px] py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <StatusIcon status={issue.status} />
                    <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0", statusColors[issue.status])}>
                      {issue.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-[10px] py-1.5">{issue.assignee}</TableCell>
                <TableCell className="text-[10px] py-1.5 tabular-nums text-muted-foreground">{issue.dateOpened}</TableCell>
                <TableCell className="text-[10px] py-1.5 text-center tabular-nums">
                  {issue.hoursToResolve !== null ? (
                    <span className={cn("font-semibold", issue.exceeds24Hours ? "text-destructive" : "text-foreground")}>
                      {issue.hoursToResolve}h
                      {issue.exceeds24Hours && <AlertTriangle className="size-2.5 inline ml-0.5 text-destructive" />}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {issues.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-[10px] py-4 text-muted-foreground">
                  No issues matching current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
