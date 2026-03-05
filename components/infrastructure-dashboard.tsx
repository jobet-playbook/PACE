"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  infraPaceItems,
  infraHealthMetrics,
  awsClientMetrics,
  infraPaceSummary,
} from "@/lib/dashboard-data"
import {
  Server,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  DollarSign,
  Activity,
  Cloud,
  CheckCircle,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

const timeWindows = [
  { value: "7", label: "Last 7 Days" },
  { value: "14", label: "Last 14 Days" },
  { value: "30", label: "Last 30 Days" },
]

function TrendIcon({ trend, isGoodWhenLow }: { trend: "up" | "down" | "stable"; isGoodWhenLow?: boolean }) {
  const isGood = isGoodWhenLow ? trend === "down" : trend === "up"
  if (trend === "stable") return <Minus className="size-3 text-muted-foreground" />
  if (trend === "up") return <TrendingUp className={cn("size-3", isGood ? "text-chart-2" : "text-destructive")} />
  return <TrendingDown className={cn("size-3", isGood ? "text-chart-2" : "text-destructive")} />
}

export function InfrastructureDashboard() {
  const [timeWindow, setTimeWindow] = useState("7")

  const paceSummary = timeWindow === "7" 
    ? infraPaceSummary.last7Days 
    : timeWindow === "14" 
      ? infraPaceSummary.last14Days 
      : infraPaceSummary.last30Days

  const filteredItems = infraPaceItems.filter((item) => {
    const itemDate = new Date(item.completedDate.replace(/(\d{2})\/(\d{2})\/(\d{2})/, "20$3-$1-$2"))
    const daysAgo = Math.floor((Date.now() - itemDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysAgo <= parseInt(timeWindow)
  })

  const totalAwsClients = awsClientMetrics.length
  const totalRevenue = awsClientMetrics.reduce((s, c) => s + c.monthlyRevenue, 0)
  const totalAwsCost = awsClientMetrics.reduce((s, c) => s + c.awsCost, 0)
  const avgCostPercent = ((totalAwsCost / totalRevenue) * 100).toFixed(1)

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* Header with Tooltip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-chart-3 text-card">
              <Server className="size-3.5" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Infrastructure Pace Dashboard</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center justify-center rounded-full bg-muted p-1 hover:bg-muted/80">
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs p-3 text-xs">
                <p className="font-semibold mb-1.5">How Infrastructure Pace is Calculated:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="size-3 mt-0.5 text-chart-2 shrink-0" />
                    <span><strong>RICE Tickets:</strong> High RICE score performance improvement tickets accepted by Documentation team</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="size-3 mt-0.5 text-chart-2 shrink-0" />
                    <span><strong>Jira Tasks:</strong> Tasks confirmed by CTO in their Jira board</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="size-3 mt-0.5 text-chart-2 shrink-0" />
                    <span><strong>Weekly Summaries:</strong> Infrastructure improvements documented in weekly reviews</span>
                  </li>
                </ul>
                <p className="mt-2 text-muted-foreground">Story points are assigned to each job-to-be-done and sum to Infrastructure Pace.</p>
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

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Pace Summary + Pace Items Table */}
          <div className="flex flex-col gap-3">
            {/* Pace Summary Cards */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="py-2 px-2.5 gap-0 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Total SP</p>
                <p className="text-lg font-bold text-foreground tabular-nums">{paceSummary.totalSP}</p>
              </Card>
              <Card className="py-2 px-2.5 gap-0 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">RICE Tix</p>
                <p className="text-lg font-bold text-chart-1 tabular-nums">{paceSummary.riceTickets}</p>
              </Card>
              <Card className="py-2 px-2.5 gap-0 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Jira Tasks</p>
                <p className="text-lg font-bold text-chart-3 tabular-nums">{paceSummary.jiraTasks}</p>
              </Card>
              <Card className="py-2 px-2.5 gap-0 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Weekly</p>
                <p className="text-lg font-bold text-chart-2 tabular-nums">{paceSummary.weeklySummary}</p>
              </Card>
            </div>

            {/* Pace Items Table */}
            <Card className="py-2.5 px-3 gap-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="size-3 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Infrastructure Pace Items ({filteredItems.length})
                </p>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[9px] h-7 font-semibold">ID</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold">Description</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold">Type</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold text-center">SP</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="text-[10px] py-1.5 font-medium text-primary">{item.id}</TableCell>
                        <TableCell className="text-[10px] py-1.5 max-w-[200px] truncate" title={item.description}>
                          {item.description}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[8px] px-1.5 py-0",
                              item.type === "RICE Ticket" && "border-chart-1 text-chart-1",
                              item.type === "Jira Task" && "border-chart-3 text-chart-3",
                              item.type === "Weekly Summary" && "border-chart-2 text-chart-2"
                            )}
                          >
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-center font-semibold tabular-nums">{item.sp}</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-muted-foreground tabular-nums">{item.completedDate}</TableCell>
                      </TableRow>
                    ))}
                    {filteredItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-[10px] py-4 text-muted-foreground">
                          No items in selected time window
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Right Column: Health Metrics + AWS Costs */}
          <div className="flex flex-col gap-3">
            {/* Health Metrics */}
            <Card className="py-2.5 px-3 gap-0">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="size-3 text-destructive" />
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Infrastructure Health Metrics
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {infraHealthMetrics.map((metric) => {
                  const delta = metric.current - metric.previous
                  const deltaPercent = metric.previous !== 0 ? ((delta / metric.previous) * 100).toFixed(1) : "0"
                  const isGood = metric.isGoodWhenLow ? delta < 0 : delta > 0
                  return (
                    <div key={metric.label} className="flex flex-col gap-0.5 rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[9px] font-semibold text-muted-foreground truncate">{metric.label}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold tabular-nums text-foreground">
                          {metric.current.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{metric.unit}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendIcon trend={metric.trend} isGoodWhenLow={metric.isGoodWhenLow} />
                        <span className={cn("text-[9px] font-medium tabular-nums", isGood ? "text-chart-2" : "text-destructive")}>
                          {delta > 0 ? "+" : ""}{deltaPercent}%
                        </span>
                        <span className="text-[9px] text-muted-foreground">vs prev</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* AWS Clients Summary */}
            <Card className="py-2.5 px-3 gap-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Cloud className="size-3 text-chart-3" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    AWS Client Metrics
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[9px]">
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{totalAwsClients}</strong> Clients
                  </span>
                  <span className="text-muted-foreground">
                    Avg Cost: <strong className={cn("text-foreground", parseFloat(avgCostPercent) > 10 ? "text-destructive" : "text-chart-2")}>{avgCostPercent}%</strong> of Rev
                  </span>
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[9px] h-7 font-semibold">Client</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold text-right">Revenue</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold text-right">AWS Cost</TableHead>
                      <TableHead className="text-[9px] h-7 font-semibold text-right">% of Rev</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {awsClientMetrics.map((client) => (
                      <TableRow key={client.clientName} className="hover:bg-muted/30">
                        <TableCell className="text-[10px] py-1.5 font-medium">{client.clientName}</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right tabular-nums">
                          ${client.monthlyRevenue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right tabular-nums">
                          ${client.awsCost.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right tabular-nums">
                          <span className={cn("font-semibold", client.costAsPercentOfRevenue > 10 ? "text-destructive" : "text-chart-2")}>
                            {client.costAsPercentOfRevenue.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Totals Row */}
              <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                <span className="text-[10px] font-semibold text-muted-foreground">TOTAL</span>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="tabular-nums">
                    <DollarSign className="size-2.5 inline text-muted-foreground" />
                    <strong>{totalRevenue.toLocaleString()}</strong>
                  </span>
                  <span className="tabular-nums">
                    <Cloud className="size-2.5 inline text-chart-3" />
                    <strong>${totalAwsCost.toLocaleString()}</strong>
                  </span>
                  <span className={cn("font-bold", parseFloat(avgCostPercent) > 10 ? "text-destructive" : "text-chart-2")}>
                    {avgCostPercent}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
