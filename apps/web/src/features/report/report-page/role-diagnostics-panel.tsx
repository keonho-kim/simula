import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  REPORT_SYSTEM_ROLES,
  roleLabel,
  type ReportSystemRole,
  type RoleDiagnosticEvent,
  type RoleDiagnosticSummary,
} from "../report-view-model"
import { EmptyPanel, MetricChip, timeLabel } from "./ui"

export function RoleDiagnosticsPanel({
  summaries,
  selectedRole,
  selectedSummary,
  events,
  t,
  onRoleChange,
}: {
  summaries: RoleDiagnosticSummary[]
  selectedRole: ReportSystemRole
  selectedSummary?: RoleDiagnosticSummary
  events: RoleDiagnosticEvent[]
  t: UiTexts
  onRoleChange: (role: ReportSystemRole) => void
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h3 className="font-heading text-sm font-semibold">{t.systemRoleSignals}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t.systemRoleSignalsDescription}</p>
        </div>
        <Select value={selectedRole} onValueChange={(value) => onRoleChange(value as ReportSystemRole)}>
          <SelectTrigger size="sm" className="w-[220px]">
            <SelectValue placeholder={t.role} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {REPORT_SYSTEM_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(role)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[calc(100svh-260px)] min-h-[520px] p-4">
        <div className="flex flex-col gap-4 pr-3">
          <div className="grid gap-3 md:grid-cols-3">
            {summaries.map((summary) => (
              <RoleSummaryCard key={summary.role} summary={summary} selected={summary.role === selectedRole} />
            ))}
          </div>

          {selectedSummary ? (
            <section className="rounded-md border border-border/70 bg-background/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-heading text-sm font-semibold">{selectedSummary.label}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedSummary.latestSignal}</p>
                </div>
                <Badge variant={selectedSummary.status === "failed" ? "destructive" : "secondary"} className="rounded-sm">
                  {selectedSummary.status}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <MetricChip label={t.messages} value={selectedSummary.messageCount} />
                <MetricChip label={t.metrics} value={selectedSummary.metricCount} />
                <MetricChip label={t.nodes} value={selectedSummary.nodeEventCount} />
                <MetricChip label={t.logs} value={selectedSummary.logCount} />
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            {events.length ? (
              events.map((event) => <DiagnosticEventCard key={event.id} event={event} />)
            ) : (
              <EmptyPanel title={t.noRoleDiagnostics} body={t.noRoleDiagnosticsDescription} />
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}

function RoleSummaryCard({ summary, selected }: { summary: RoleDiagnosticSummary; selected: boolean }) {
  return (
    <div className={cn("rounded-md border bg-background/80 p-3", selected ? "border-foreground/20" : "border-border/70")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{summary.label}</span>
        <Badge variant={summary.status === "failed" ? "destructive" : "outline"} className="rounded-sm">
          {summary.status}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary.latestSignal}</p>
    </div>
  )
}

function DiagnosticEventCard({ event }: { event: RoleDiagnosticEvent }) {
  return (
    <article className="rounded-md border border-border/70 bg-background/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-sm">{event.kind}</Badge>
          <h4 className="text-xs font-semibold">{event.title}</h4>
        </div>
        <time className="font-mono text-[10px] text-muted-foreground">{timeLabel(event.timestamp)}</time>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{event.body}</p>
    </article>
  )
}
