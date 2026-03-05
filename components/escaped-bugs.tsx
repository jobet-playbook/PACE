"use client"

import { useState, useMemo } from "react"
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ShieldAlert, Filter, AlertTriangle, Clock, Users } from "lucide-react"
import type { EscapedBug } from "@/lib/dashboard-data"

interface EscapedBugsProps {
  bugs: EscapedBug[]
}

export function EscapedBugsTable({ bugs }: EscapedBugsProps) {
  const [filterQA, setFilterQA] = useState<string>("all")
  const [filterCoder, setFilterCoder] = useState<string>("all")
  const [filterCR, setFilterCR] = useState<string>("all")
  const [filterEscapedFrom, setFilterEscapedFrom] = useState<string>("all")
  const [filterEnvironment, setFilterEnvironment] = useState<string>("all")

  // Get unique values for filters
  const qaOwners = useMemo(() => [...new Set(bugs.map(b => b.qaOwner))], [bugs])
  const coders = useMemo(() => [...new Set(bugs.map(b => b.developer))], [bugs])
  const reviewers = useMemo(() => [...new Set(bugs.map(b => b.codeReviewer))], [bugs])

  const filtered = useMemo(() => {
    let result = [...bugs]

    if (filterQA !== "all") {
      result = result.filter(b => b.qaOwner === filterQA)
    }
    if (filterCoder !== "all") {
      result = result.filter(b => b.developer === filterCoder)
    }
    if (filterCR !== "all") {
      result = result.filter(b => b.codeReviewer === filterCR)
    }
    if (filterEscapedFrom !== "all") {
      result = result.filter(b => b.escapedFrom === filterEscapedFrom)
    }
    if (filterEnvironment !== "all") {
      result = result.filter(b => b.environment === filterEnvironment)
    }

    // Sort by severity then by detection days
    result.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "Critical" ? -1 : 1
      }
      return b.daysToDetect - a.daysToDetect
    })

    return result
  }, [bugs, filterQA, filterCoder, filterCR, filterEscapedFrom, filterEnvironment])

  // Summary stats
  const criticalCount = filtered.filter(b => b.severity === "Critical").length
  const prodCount = filtered.filter(b => b.environment === "Production").length
  const avgDetectionDays = filtered.length > 0
    ? (filtered.reduce((s, b) => s + b.daysToDetect, 0) / filtered.length).toFixed(1)
    : "0"
  const qaEscapes = filtered.filter(b => b.escapedFrom === "QA" || b.escapedFrom === "Both").length
  const crEscapes = filtered.filter(b => b.escapedFrom === "Code Review" || b.escapedFrom === "Both").length

  const clearFilters = () => {
    setFilterQA("all")
    setFilterCoder("all")
    setFilterCR("all")
    setFilterEscapedFrom("all")
    setFilterEnvironment("all")
  }

  const hasActiveFilters = filterQA !== "all" || filterCoder !== "all" || filterCR !== "all" || filterEscapedFrom !== "all" || filterEnvironment !== "all"

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="rounded-lg bg-destructive px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-3.5 text-destructive-foreground" />
          <h3 className="text-xs font-semibold text-destructive-foreground">Escaped Bugs Log</h3>
          <Badge variant="outline" className="ml-auto text-[9px] border-destructive-foreground/30 text-destructive-foreground">
            {filtered.length} escaped
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
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Production</span>
          <span className="text-sm font-bold text-destructive tabular-nums">{prodCount}</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Detection</span>
          <span className="text-sm font-bold text-foreground tabular-nums">{avgDetectionDays}d</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">QA Escapes</span>
          <span className="text-sm font-bold text-primary tabular-nums">{qaEscapes}</span>
        </Card>
        <Card className="py-2 px-2.5 gap-0 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">CR Escapes</span>
          <span className="text-sm font-bold text-chart-3 tabular-nums">{crEscapes}</span>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
        <Filter className="size-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Filter By</span>
        
        <Select value={filterQA} onValueChange={setFilterQA}>
          <SelectTrigger className="h-6 w-[130px] text-[10px]">
            <SelectValue placeholder="QA Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All QA</SelectItem>
            {qaOwners.map(q => (
              <SelectItem key={q} value={q}>{q}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCoder} onValueChange={setFilterCoder}>
          <SelectTrigger className="h-6 w-[130px] text-[10px]">
            <SelectValue placeholder="Developer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devs</SelectItem>
            {coders.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCR} onValueChange={setFilterCR}>
          <SelectTrigger className="h-6 w-[130px] text-[10px]">
            <SelectValue placeholder="Code Reviewer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All CR</SelectItem>
            {reviewers.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEscapedFrom} onValueChange={setFilterEscapedFrom}>
          <SelectTrigger className="h-6 w-[110px] text-[10px]">
            <SelectValue placeholder="Escaped From" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="QA">QA</SelectItem>
            <SelectItem value="Code Review">Code Review</SelectItem>
            <SelectItem value="Both">Both</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterEnvironment} onValueChange={setFilterEnvironment}>
          <SelectTrigger className="h-6 w-[100px] text-[10px]">
            <SelectValue placeholder="Environment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Envs</SelectItem>
            <SelectItem value="Production">Production</SelectItem>
            <SelectItem value="Staging">Staging</SelectItem>
            <SelectItem value="Beta">Beta</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            className="text-[10px] text-primary hover:text-primary/80 font-medium underline underline-offset-2"
            onClick={clearFilters}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
          No escaped bugs found matching the current filters.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px]">Ticket</TableHead>
                <TableHead className="text-[10px] w-[70px]">Severity</TableHead>
                <TableHead className="text-[10px] w-[70px]">Env</TableHead>
                <TableHead className="text-[10px] w-[80px]">Escaped</TableHead>
                <TableHead className="text-[10px]">
                  <div className="flex items-center gap-1">
                    <Users className="size-2.5" /> QA
                  </div>
                </TableHead>
                <TableHead className="text-[10px]">
                  <div className="flex items-center gap-1">
                    <Users className="size-2.5" /> Dev
                  </div>
                </TableHead>
                <TableHead className="text-[10px]">
                  <div className="flex items-center gap-1">
                    <Users className="size-2.5" /> CR
                  </div>
                </TableHead>
                <TableHead className="text-[10px] w-[60px]">
                  <div className="flex items-center gap-1">
                    <Clock className="size-2.5" /> Days
                  </div>
                </TableHead>
                <TableHead className="text-[10px]">Summary</TableHead>
                <TableHead className="text-[10px]">Root Cause</TableHead>
                <TableHead className="text-[10px]">Customer Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((bug) => (
                <TableRow key={bug.id} className="text-[11px]">
                  <TableCell className="font-medium text-primary whitespace-nowrap">{bug.ticketKey}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "text-[9px] px-1.5 py-0",
                      bug.severity === "Critical" 
                        ? "bg-destructive text-destructive-foreground" 
                        : "bg-primary/15 text-primary border border-primary/30"
                    )}>
                      {bug.severity === "Critical" && <AlertTriangle className="size-2 mr-0.5" />}
                      {bug.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] px-1.5 py-0",
                      bug.environment === "Production" ? "border-destructive text-destructive" :
                      bug.environment === "Staging" ? "border-primary text-primary" :
                      "border-muted-foreground text-muted-foreground"
                    )}>
                      {bug.environment}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[9px] px-1.5 py-0",
                      bug.escapedFrom === "Both" ? "border-destructive text-destructive" :
                      bug.escapedFrom === "QA" ? "border-primary text-primary" :
                      "border-chart-3 text-chart-3"
                    )}>
                      {bug.escapedFrom}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{bug.qaOwner}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{bug.developer}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{bug.codeReviewer}</TableCell>
                  <TableCell className="tabular-nums font-semibold text-foreground text-center">{bug.daysToDetect}d</TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">{bug.summary}</TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="line-clamp-2 text-[10px] leading-tight text-muted-foreground">{bug.rootCause}</span>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <span className="line-clamp-2 text-[10px] leading-tight text-destructive">{bug.customerImpact}</span>
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
