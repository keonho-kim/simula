import { cn } from "@/ui/lib/class-names"

export function EmptyPanel({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-md border border-dashed border-border/80 bg-muted/30 text-sm", compact ? "p-3" : "p-4")}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  )
}
