import { useMemo, useState } from "react"
import {
  AlertCircleIcon,
  BrainIcon,
  GaugeIcon,
  ListIcon,
  RouteIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react"
import type { ModelMetrics } from "@simula/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"
import type { LogItem, ReasoningEntry, RolePanelRole, RoleSummary, TraceEntry } from "./activity-rail/types"
import {
  buildLogItems,
  buildRoleSummaries,
  countMetricSamples,
  formatCount,
  formatRoleStatus,
  logToneClass,
  timeLabel,
} from "./activity-rail/view-model"

export function ActivityRail({ t }: { t: UiTexts }) {
  const events = useRunStore((state) => state.liveEvents)
  const runState = useRunStore((state) => state.runState)
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RolePanelRole>()
  const logItems = useMemo(() => buildLogItems(events, t), [events, t])
  const roleSummaries = useMemo(() => buildRoleSummaries(events, runState, t), [events, runState, t])
  const metricSamples = useMemo(() => countMetricSamples(events), [events])
  const selectedSummary = roleSummaries.find((summary) => summary.role === selectedRole)

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm font-semibold">{t.activity}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t.activityDescription}</p>
          </div>
          <Badge variant="outline" className="rounded-md bg-background/70">
            {events.length} {t.events}
          </Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-3 gap-2">
            <SignalStat label={t.logs} value={logItems.length} />
            <SignalStat label={t.rolesLabel} value={roleSummaries.filter((summary) => summary.status !== "idle").length} />
            <SignalStat label={t.samples} value={metricSamples} />
          </div>

          <Button className="w-full justify-between" variant="outline" onClick={() => setLogsOpen(true)}>
            <span className="flex items-center gap-2">
              <ListIcon className="size-4" />
              {t.openLogs}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{logItems.length}</span>
          </Button>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t.roleSignals}</h3>
              <span className="text-[10px] text-muted-foreground">{t.nonActor}</span>
            </div>
            <div className="grid gap-2">
              {roleSummaries.map((summary) => (
                <RoleSignalButton key={summary.role} summary={summary} t={t} onClick={() => setSelectedRole(summary.role)} />
              ))}
            </div>
          </section>
        </div>

      </div>

      <LogDialog open={logsOpen} onOpenChange={setLogsOpen} items={logItems} t={t} />
      <RoleDialog summary={selectedSummary} t={t} onOpenChange={(open) => !open && setSelectedRole(undefined)} />
    </aside>
  )
}

function SignalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/80 px-2.5 py-2">
      <div className="font-mono text-base font-semibold leading-none">{value.toLocaleString()}</div>
      <div className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  )
}

function RoleSignalButton({ summary, t, onClick }: { summary: RoleSummary; t: UiTexts; onClick: () => void }) {
  return (
    <button
      type="button"
      className={roleSignalButtonClass(summary.status)}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className={roleSignalIconClass(summary.status)}>
          <RoleIcon role={summary.role} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{summary.label}</span>
            <Badge variant={summary.status === "failed" ? "destructive" : "secondary"} className={roleSignalBadgeClass(summary.status)}>
              {formatRoleStatus(summary.status, t)}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary.preview}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatCount(summary.messages.length, t.messageCountLabel, t)}</span>
            <span>{formatCount(summary.reasoning.length, t.thinkingCountLabel, t)}</span>
            <span>{formatCount(summary.metrics.length, t.metricCountLabel, t)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export function roleSignalButtonClass(status: RoleSummary["status"]): string {
  return cn(
    "rounded-md border border-border/70 bg-background/80 p-3 text-left transition-colors hover:bg-background hover:ring-1 hover:ring-border",
    status === "running" && "border-emerald-300 bg-emerald-50/80 ring-1 ring-emerald-200"
  )
}

function roleSignalIconClass(status: RoleSummary["status"]): string {
  return cn(
    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
    status === "running" && "bg-emerald-100 text-emerald-700"
  )
}

function roleSignalBadgeClass(status: RoleSummary["status"]): string {
  return cn(
    "h-4 rounded-sm px-1.5 text-[10px]",
    status === "running" && "bg-emerald-100 text-emerald-800"
  )
}

function RoleIcon({ role }: { role: RolePanelRole }) {
  if (role === "planner") return <BrainIcon className="size-4" />
  if (role === "generator") return <SparklesIcon className="size-4" />
  if (role === "coordinator") return <RouteIcon className="size-4" />
  if (role === "observer") return <GaugeIcon className="size-4" />
  return <WrenchIcon className="size-4" />
}

function LogDialog({ open, onOpenChange, items, t }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: LogItem[]
  t: UiTexts
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86svh] overflow-hidden sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>{t.runtimeLogs}</DialogTitle>
          <DialogDescription>{t.runtimeLogsDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[64svh] pr-3">
          {items.length ? (
            <div className="space-y-2 pr-3">
              {items.map((item) => <LogCard key={item.id} item={item} />)}
            </div>
          ) : (
            <EmptyActivity title={t.noLogs} body={t.noLogsDescription} />
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function RoleDialog({ summary, t, onOpenChange }: {
  summary: RoleSummary | undefined
  t: UiTexts
  onOpenChange: (open: boolean) => void
}) {
  if (!summary) {
    return null
  }
  const latestMetric = summary.metrics.at(-1)
  return (
    <Dialog open={Boolean(summary)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88svh] flex-col overflow-hidden sm:max-w-[1080px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{summary.label}</DialogTitle>
          <DialogDescription>{summary.description}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 overflow-hidden pr-3">
          <div className="flex flex-col gap-5 pr-3 pb-1">
            <div className="grid gap-3 md:grid-cols-4">
              <SignalStat label={t.messages} value={summary.messages.length} />
              <SignalStat label={t.think} value={summary.reasoning.length} />
              <SignalStat label={t.metrics} value={summary.metrics.length} />
              <SignalStat label={t.logs} value={summary.logs.length} />
            </div>

            <LatestTelemetry metric={latestMetric} t={t} />

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t.stateSignals}</h3>
                <Badge variant="outline" className="rounded-sm bg-background">{formatRoleStatus(summary.status, t)}</Badge>
              </div>
              {summary.sections.length ? (
                <div className="divide-y divide-border/60 overflow-hidden rounded-md bg-muted/20">
                  {summary.sections.map((entry) => (
                    <RoleSignalSection key={entry.step} entry={entry} t={t} />
                  ))}
                </div>
              ) : (
                <EmptyActivity title={t.noStateSignal} body={summary.preview} />
              )}
            </section>

            <ReasoningStream items={summary.reasoning} t={t} />
            <RawModelStream messages={summary.messages} t={t} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function LatestTelemetry({ metric, t }: { metric: ModelMetrics | undefined; t: UiTexts }) {
  return (
    <section className="rounded-md bg-muted/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t.latestTelemetry}</h3>
        <span className="text-[10px] uppercase text-muted-foreground">{metric ? t.lastSample : t.noSample}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <MetricChip label="TTFT" value={metric ? `${metric.ttftMs}ms` : "-"} />
        <MetricChip label={t.metricDuration} value={metric ? `${metric.durationMs}ms` : "-"} />
        <MetricChip label={t.metricTotalTokens} value={metric ? metric.totalTokens.toLocaleString() : "-"} />
        <MetricChip label={t.metricReasoningTokens} value={metric ? metric.reasoningTokens.toLocaleString() : "-"} />
        <MetricChip label={t.metricAttempt} value={metric ? String(metric.attempt) : "-"} />
      </div>
    </section>
  )
}

function LogCard({ item }: { item: LogItem }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/80 p-3">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${logToneClass(item.level)}`}>
          <AlertCircleIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold">{item.title}</p>
            <time className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeLabel(item.timestamp)}</time>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
        </div>
      </div>
    </div>
  )
}

function RoleSignalSection({ entry, t }: { entry: TraceEntry; t: UiTexts }) {
  return (
    <section className="px-4 py-4">
      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground">{entry.label}</h4>
      <MarkdownContent className="mt-2" content={entry.content} fallback={t.noSignalYet} />
    </section>
  )
}

function ReasoningStream({ items, t }: { items: ReasoningEntry[]; t: UiTexts }) {
  return (
    <details className="rounded-md border border-border/70 bg-background/80 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
        {t.think} ({items.length})
      </summary>
      {items.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {items.slice(-8).map((item) => (
            <details key={item.id} className="rounded-md bg-muted/30 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                {item.step} · attempt {item.attempt} · {timeLabel(item.timestamp)} · {item.reasoningTokens.toLocaleString()} tokens
              </summary>
              <MarkdownContent compact className="mt-2" content={item.content} fallback="-" />
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t.noReasoningSignals}</p>
      )}
    </details>
  )
}

function RawModelStream({ messages, t }: { messages: Array<{ content: string; timestamp: string }>; t: UiTexts }) {
  return (
    <details className="rounded-md border border-border/70 bg-background/80 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
        {t.rawModelStream} ({messages.length})
      </summary>
      {messages.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {messages.slice(-8).map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className="rounded-md bg-muted/30 p-3">
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">{timeLabel(message.timestamp)}</div>
              <MarkdownContent compact content={message.content} fallback="-" />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t.noModelMessages}</p>
      )}
    </details>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold">{value}</div>
    </div>
  )
}

function EmptyActivity({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/80 bg-muted/30 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  )
}
