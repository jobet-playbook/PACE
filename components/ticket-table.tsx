"use client"

import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Ticket } from "@/lib/dashboard-data"

interface TicketTableProps {
  tickets: Ticket[]
  title: string
  variant: "critical" | "aging"
  statusLabel?: string
}

function getStatusColor(status: string) {
  switch (status) {
    case "QA":
    case "Documentation":
      return "bg-primary text-primary-foreground"
    case "Push Staging":
    case "Ready for Dev":
      return "bg-muted text-muted-foreground"
    case "Code Review":
    case "In Review":
      return "bg-chart-3 text-card"
    case "DR":
    case "Approved":
      return "bg-chart-2 text-card"
    default:
      return "bg-secondary text-secondary-foreground"
  }
}

export function TicketTable({ tickets, title, variant, statusLabel = "STS" }: TicketTableProps) {
  if (tickets.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className={cn(
        "px-4 py-2.5",
        variant === "critical" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
      )}>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="text-xs">Key</TableHead>
            <TableHead className="text-xs text-right">Age</TableHead>
            <TableHead className="text-xs text-right">R.Age</TableHead>
            <TableHead className="text-xs text-right">SP</TableHead>
            <TableHead className="text-xs">Assignee</TableHead>
            <TableHead className="text-xs">Developer</TableHead>
            <TableHead className="text-xs text-center">Ret.</TableHead>
            <TableHead className="text-xs">First</TableHead>
            <TableHead className="text-xs">Latest</TableHead>
            <TableHead className="text-xs">{statusLabel}</TableHead>
            <TableHead className="text-xs">Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.key} className="text-xs">
              <TableCell className="font-medium text-primary">{ticket.key}</TableCell>
              <TableCell className="text-right tabular-nums">{ticket.age}</TableCell>
              <TableCell className="text-right tabular-nums">{ticket.recentAge}</TableCell>
              <TableCell className="text-right tabular-nums">{ticket.sp ?? "-"}</TableCell>
              <TableCell className="text-muted-foreground">{ticket.assignee}</TableCell>
              <TableCell className="text-muted-foreground">{ticket.developer}</TableCell>
              <TableCell className="text-center tabular-nums">{ticket.returnCount}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{ticket.firstQA}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{ticket.latestQA}</TableCell>
              <TableCell>
                <Badge className={cn("text-[10px] px-1.5 py-0.5", getStatusColor(ticket.status))}>
                  {ticket.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[280px] truncate text-muted-foreground">{ticket.summary}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
