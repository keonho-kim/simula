import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold">{value.toLocaleString()}</div>
    </div>
  )
}

export function EmptyPanel({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-md border border-dashed border-border/80 bg-muted/30 text-sm", compact ? "p-3" : "p-4")}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  )
}

export function ExportButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" disabled={disabled} onClick={onClick}>
      <DownloadIcon data-icon="inline-start" />
      {label}
    </Button>
  )
}

export function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
