"use client"

import { useState, useMemo } from "react"
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Bug, TrendingDown, AlertTriangle, Filter } from "lucide-react"
import type { BugAnalysisEntry } from "@/lib/dashboard-data"

interface BugAnalysisTableProps {
  bugs: BugAnalysisEntry[]
  filterMember?: string
}

function impactColor(score: number) {
  if (score >= 8) return "text-destructive font-bold"
  if (score >= 5) return "text-primary font-semibold"
  return "text-muted-foreground font-medium"
}

function severityBadge(severity: string) {
  if (severity === "Critical") return "bg-destructive text-destructive-foreground"
  return "bg-primary/15 text-primary border border-primary/30"
}

export function BugAnalysisTable({ bugs, filterMember }: BugAnalysisTableProps) {
  const [sortBy, setSortBy] = useState<"impact" | "date" | "severity">("impact")
  const [filterSeverity, setFilterSeverity] = useState<"all" | "Critical" | "Semi-Critical">("all")
  const [filterRole, setFilterRole] = useState<"all" | "dev" | "cr" | "qa">("all")

  const filtered = useMemo(() => {
    let result = [...bugs]

    if (filterSeverity !== "all") {
      result = result.filter(b => b.severity === filterSeverity)
    }

    if (filterMember && filterMember !== "all") {
      if (filterRole === "all") {
        result = result.filter(b =>
          b.causedByDev === filterMember ||
          b.causedByCodeReviewer === filterMember ||
          b.causedByQA === filterMember
        )
      } else if (filterRole === "dev") {
        result = result.filter(b => b.causedByDev === filterMember)
      } else if (filterRole === "cr") {
        result = result.filter(b => b.causedByCodeReviewer === filterMember)
      } else if (filterRole === "qa") {
        result = result.filter(b => b.causedByQA === filterMember)
      }
    }

    if (filterRole !== "all" && (!filterMember || filterMember === "all")) {
      // no further filtering by role without a member
    }

    result.sort((a, b) => {
      if (sortBy === "impact") return b.impactScore - a.impactScore
      if (sortBy === "severity") {
        if (a.severity === b.severity) return b.impactScore - a.impactScore
        return a.severity === "Critical" ? -1 : 1
      }
      return new Date(b.dateDiscovered).getTime() - new Date(a.dateDiscovered).getTime()
    })

    return result
  }, [bugs, filterSeverity, filterMember, filterRole, sortBy])

  // Summary stats
  const criticalCount = filtered.filter(b => b.severity === "Critical").length
  const semiCriticalCount = filtered.filter(b => b.severity === "Semi-Critical").length
  const avgImpact = filtered.length > 0
    ? (filtered.reduce((s, b) => s + b.impactScore, 0) / filtered.length).toFixed(1)
    : "0"
  const totalQaPenalty = filtered.reduce((s, b) => s + b.qaPacePenalty, 0).toFixed(1)
  const totalCrPenalty = filtered.reduce((s, b) => s + b.crPacePenalty, 0).toFixed(1)

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="rounded-lg bg-destructive px-3 py-2">
        <div className="flex items-center gap-2">
          <Bug className="size-3.5 text-destructive-foreground" />
          <h3 className="text-xs font-semibold text-destructive-foreground">Bug Analysis</h3>
          <Badge variant="outline" className="ml-auto text-[9px] border-destructive-foreground/30 text-destructive-foreground">
            {filtered.length} bugs
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-2">
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Critical</span>
          <span className="text-sm font-bold text-destructive tabular-nums">{criticalCount}</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Semi-Critical</span>
          <span className="text-sm font-bold text-primary tabular-nums">{semiCriticalCount}</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Impact</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{avgImpact}/10</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">QA Penalty</span>
          <span className="text-sm font-bold text-destructive tabular-nums">{totalQaPenalty} SP</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">CR Penalty</span>
          <span className="text-sm font-bold text-destructive tabular-nums">{totalCrPenalty} SP</span>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
        <Filter className="size-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Bug Filters</span>
        <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as typeof filterSeverity)}>
          <SelectTrigger className="h-6 w-[120px] text-[10px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
            <SelectItem value="Semi-Critical">Semi-Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v as typeof filterRole)}>
          <SelectTrigger className="h-6 w-[120px] text-[10px]">
            <SelectValue placeholder="Caused By Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="dev">Dev Caused</SelectItem>
            <SelectItem value="cr">CR Missed</SelectItem>
            <SelectItem value="qa">QA Missed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-6 w-[110px] text-[10px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="impact">By Impact</SelectItem>
            <SelectItem value="severity">By Severity</SelectItem>
            <SelectItem value="date">By Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
          No bugs found matching the current filters.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] w-[60px]">QA Pen.</TableHead>
                <TableHead className="text-[10px] w-[60px]">CR Pen.</TableHead>
                <TableHead className="text-[10px]">Ticket</TableHead>
                <TableHead className="text-[10px] text-center w-[48px]">Impact</TableHead>
                <TableHead className="text-[10px] w-[72px]">Severity</TableHead>
                <TableHead className="text-[10px]">Caused by Dev</TableHead>
                <TableHead className="text-[10px]">Caused by CR</TableHead>
                <TableHead className="text-[10px]">Caused by QA</TableHead>
                <TableHead className="text-[10px] w-[70px]">Pushed</TableHead>
                <TableHead className="text-[10px] w-[70px]">Found</TableHead>
                <TableHead className="text-[10px]">Summary</TableHead>
                <TableHead className="text-[10px]">Lessons Learned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((bug) => (
                <TableRow key={bug.id} className="text-[11px]">
                  <TableCell className="tabular-nums">
                    <span className="inline-flex items-center gap-0.5 text-destructive font-semibold">
                      <TrendingDown className="size-2.5" />
                      {bug.qaPacePenalty} SP
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <span className="inline-flex items-center gap-0.5 text-destructive font-semibold">
                      <TrendingDown className="size-2.5" />
                      {bug.crPacePenalty} SP
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-primary whitespace-nowrap">{bug.ticketKey}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn("tabular-nums text-xs", impactColor(bug.impactScore))}>
                      {bug.impactScore}/10
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px] px-1.5 py-0", severityBadge(bug.severity))}>
                      {bug.severity === "Critical" && <AlertTriangle className="size-2 mr-0.5" />}
                      {bug.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{bug.causedByDev}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{bug.causedByCodeReviewer}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{bug.causedByQA}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">{bug.datePushed}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">{bug.dateDiscovered}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{bug.summary}</TableCell>
                  <TableCell className="max-w-[240px] text-muted-foreground">
                    <span className="line-clamp-2 text-[10px] leading-tight">{bug.lessonsLearned}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
