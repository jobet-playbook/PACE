"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Sparkles, Filter, AlertTriangle, AlertCircle, Info } from "lucide-react"
import type { AIInsight, InsightCause } from "@/lib/dashboard-data"

interface AIInsightsProps {
  insights: AIInsight[]
  filterMember?: string
}

const causeOptions: InsightCause[] = ["Process Gap", "Communication", "Technical Debt", "Training Needed", "Resource Constraint"]

const severityColors = {
  High: "bg-destructive text-destructive-foreground",
  Medium: "bg-primary text-primary-foreground",
  Low: "bg-muted text-muted-foreground",
}

const severityIcons = {
  High: AlertTriangle,
  Medium: AlertCircle,
  Low: Info,
}

const causeColors: Record<InsightCause, string> = {
  "Process Gap": "bg-chart-1/15 text-chart-1 border-chart-1/30",
  "Communication": "bg-chart-2/15 text-chart-2 border-chart-2/30",
  "Technical Debt": "bg-chart-3/15 text-chart-3 border-chart-3/30",
  "Training Needed": "bg-chart-4/15 text-chart-4 border-chart-4/30",
  "Resource Constraint": "bg-chart-5/15 text-chart-5 border-chart-5/30",
}

export function AIInsights({ insights, filterMember }: AIInsightsProps) {
  const [filterCause, setFilterCause] = useState<string>("all")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")

  const filtered = useMemo(() => {
    let result = [...insights]

    if (filterMember && filterMember !== "all") {
      result = result.filter(i => i.person === filterMember)
    }

    if (filterCause !== "all") {
      result = result.filter(i => i.category === filterCause)
    }

    if (filterSeverity !== "all") {
      result = result.filter(i => i.severity === filterSeverity)
    }

    // Sort by severity (High first)
    const severityOrder = { High: 0, Medium: 1, Low: 2 }
    result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return result
  }, [insights, filterMember, filterCause, filterSeverity])

  // Summary by cause
  const causeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    causeOptions.forEach(c => counts[c] = 0)
    filtered.forEach(i => counts[i.category]++)
    return counts
  }, [filtered])

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="rounded-lg bg-gradient-to-r from-chart-3 to-chart-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-card" />
          <h3 className="text-xs font-semibold text-card">AI-Powered Insights</h3>
          <Badge variant="outline" className="ml-auto text-[9px] border-card/30 text-card">
            {filtered.length} insights
          </Badge>
        </div>
      </div>

      {/* Cause Summary Cards */}
      <div className="grid grid-cols-5 gap-1.5">
        {causeOptions.map(cause => (
          <button
            key={cause}
            onClick={() => setFilterCause(filterCause === cause ? "all" : cause)}
            className={cn(
              "rounded-md border px-2 py-1.5 text-center transition-all",
              filterCause === cause ? causeColors[cause] : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <span className="text-[8px] font-semibold uppercase tracking-wider block truncate">
              {cause}
            </span>
            <span className={cn(
              "text-sm font-bold tabular-nums",
              filterCause === cause ? "" : "text-foreground"
            )}>
              {causeCounts[cause]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
        <Filter className="size-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Filters</span>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="h-6 w-[100px] text-[10px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
          </SelectContent>
        </Select>
        {(filterCause !== "all" || filterSeverity !== "all") && (
          <button
            className="text-[10px] text-primary hover:text-primary/80 font-medium underline underline-offset-2"
            onClick={() => { setFilterCause("all"); setFilterSeverity("all") }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Insights List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
          No insights found matching the current filters.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(insight => {
            const SeverityIcon = severityIcons[insight.severity]
            return (
              <Card key={insight.id} className="py-2.5 px-3 gap-0">
                <div className="flex items-start gap-2">
                  {/* Severity Icon */}
                  <div className={cn(
                    "flex items-center justify-center size-6 rounded-full shrink-0 mt-0.5",
                    severityColors[insight.severity]
                  )}>
                    <SeverityIcon className="size-3" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-semibold text-foreground">{insight.person}</span>
                      <Badge className={cn("text-[8px] px-1.5 py-0 border", causeColors[insight.category])}>
                        {insight.category}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground ml-auto">{insight.detectedDate}</span>
                    </div>

                    <p className="text-[11px] text-foreground leading-relaxed mb-1.5">
                      {insight.insight}
                    </p>

                    <div className="flex items-start gap-1 bg-muted/50 rounded px-2 py-1.5">
                      <Sparkles className="size-3 text-chart-2 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Recommendation:</span> {insight.recommendation}
                      </p>
                    </div>

                    {insight.relatedTickets.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[9px] text-muted-foreground">Related:</span>
                        {insight.relatedTickets.map(t => (
                          <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 text-primary">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
