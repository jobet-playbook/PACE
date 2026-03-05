import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"

interface MetricCardProps {
  title: string
  children: React.ReactNode
  className?: string
  accentLabel?: string
}

export function MetricCard({ title, children, className, accentLabel }: MetricCardProps) {
  return (
    <Card className={cn("gap-1.5 py-2.5 px-3", className)}>
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{title}</p>
        {accentLabel && (
          <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary">{accentLabel}</span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        {children}
      </div>
    </Card>
  )
}

interface MetricValueProps {
  label: string
  value: string | number
  unit?: string
  delta?: number
  prior?: number
  className?: string
  small?: boolean
}

export function MetricValue({ label, value, unit, delta, prior, className, small }: MetricValueProps) {
  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {label && <span className="text-[9px] font-medium text-muted-foreground leading-tight">{label}</span>}
      <div className="flex items-baseline gap-1">
        <span className={cn("font-bold tabular-nums text-foreground", small ? "text-sm" : "text-lg leading-tight")}>
          {value}
        </span>
        {unit && <span className="text-[9px] text-muted-foreground">{unit}</span>}
        {delta !== undefined && delta !== 0 && (
          <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold", delta > 0 ? "text-chart-2" : "text-destructive")}>
            {delta > 0 ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      {prior !== undefined && (
        <span className="text-[8px] text-muted-foreground leading-tight">{"Prior: "}{prior}</span>
      )}
    </div>
  )
}
