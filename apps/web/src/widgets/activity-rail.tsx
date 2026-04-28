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
import type {
  CoordinatorTraceStep,
  ModelMetrics,
  ModelRole,
  PlannerTraceStep,
  RoleTrace,
  RoleTraceStep,
  RunEvent,
  SimulationState,
} from "@simula/shared"
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
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"

const ROLE_BUTTONS: RolePanelRole[] = ["planner", "generator", "coordinator", "observer", "repair"]
const STANDARD_TRACE_STEPS: RoleTraceStep[] = ["thought", "target", "action", "intent"]
const PLANNER_TRACE_STEPS: PlannerTraceStep[] = [
  "coreSituation",
  "actorPressures",
  "conflictDynamics",
  "simulationDirection",
  "majorEvents",
]
const COORDINATOR_TRACE_STEPS: CoordinatorTraceStep[] = [
  "runtimeFrame",
  "actorRouting",
  "interactionPolicy",
  "outcomeDirection",
  "eventInjection",
  "progressDecision",
  "extensionDecision",
]

type TraceStep = RoleTraceStep | PlannerTraceStep | CoordinatorTraceStep
type TraceEntry = {
  step: string
  label: string
  content: string
}

type RolePanelRole = Exclude<ModelRole, "storyBuilder" | "actor">

interface LogItem {
  id: string
  level: "info" | "warn" | "error"
  title: string
  body: string
  timestamp: string
}

interface RoleSummary {
  role: RolePanelRole
  label: string
  description: string
  status: string
  preview: string
  trace?: RoleTrace
  messages: Array<{ content: string; timestamp: string }>
  sections: TraceEntry[]
  metrics: ModelMetrics[]
  logs: LogItem[]
}

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
      className="rounded-md border border-border/70 bg-background/80 p-3 text-left transition-colors hover:bg-background hover:ring-1 hover:ring-border"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <RoleIcon role={summary.role} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{summary.label}</span>
            <Badge variant={summary.status === "failed" ? "destructive" : "secondary"} className="h-4 rounded-sm px-1.5 text-[10px]">
              {summary.status}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary.preview}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{summary.messages.length} {t.messages}</span>
            <span>{summary.metrics.length} {t.metrics}</span>
          </div>
        </div>
      </div>
    </button>
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
            <div className="grid gap-3 md:grid-cols-3">
              <SignalStat label={t.messages} value={summary.messages.length} />
              <SignalStat label={t.metrics} value={summary.metrics.length} />
              <SignalStat label={t.logs} value={summary.logs.length} />
            </div>

            <LatestTelemetry metric={latestMetric} t={t} />

            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t.stateSignals}</h3>
                <Badge variant="outline" className="rounded-sm bg-background">{summary.status}</Badge>
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
      <div className="grid gap-2 sm:grid-cols-4">
        <MetricChip label="TTFT" value={metric ? `${metric.ttftMs}ms` : "-"} />
        <MetricChip label={t.metricDuration} value={metric ? `${metric.durationMs}ms` : "-"} />
        <MetricChip label={t.metricTotalTokens} value={metric ? metric.totalTokens.toLocaleString() : "-"} />
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

function buildLogItems(events: RunEvent[], t: UiTexts): LogItem[] {
  return events.flatMap((event, index): LogItem[] => {
    const id = `${event.type}-${index}`
    if (event.type === "log") {
      return [{
        id,
        level: event.level,
        title: event.level.toUpperCase(),
        body: event.message,
        timestamp: event.timestamp,
      }]
    }
    if (event.type === "run.started") {
      return [{ id, level: "info", title: t.runStartedLogTitle, body: event.runId, timestamp: event.timestamp }]
    }
    if (event.type === "run.completed") {
      return [{ id, level: "info", title: t.runCompletedLogTitle, body: event.stopReason, timestamp: event.timestamp }]
    }
    if (event.type === "run.failed") {
      return [{ id, level: "error", title: t.runFailedLogTitle, body: event.error, timestamp: event.timestamp }]
    }
    if (event.type === "node.failed") {
      return [{ id, level: "error", title: event.label, body: event.error, timestamp: event.timestamp }]
    }
    if (event.type === "node.started" || event.type === "node.completed") {
      return [{ id, level: "info", title: event.label, body: event.type, timestamp: event.timestamp }]
    }
    return []
  })
}

function buildRoleSummaries(events: RunEvent[], runState: SimulationState | undefined, t: UiTexts): RoleSummary[] {
  return ROLE_BUTTONS.map((role) => {
    const trace = role === "repair" ? undefined : runState?.roleTraces.find((item) => item.role === role)
    const messages = events
      .filter((event): event is Extract<RunEvent, { type: "model.message" }> => event.type === "model.message" && event.role === role)
      .map((event) => ({ content: event.content, timestamp: event.timestamp }))
    const metrics = events
      .filter((event): event is Extract<RunEvent, { type: "model.metrics" }> => event.type === "model.metrics" && event.metrics.role === role)
      .map((event) => event.metrics)
    const logs = buildRoleLogs(events, role, t)
    return {
      role,
      label: roleLabel(role),
      description: roleDescription(role, t),
      status: roleStatus(events, role, trace, messages, logs),
      preview: rolePreview(role, trace, messages, logs, t),
      trace,
      messages,
      sections: buildRoleSections(role, trace, messages),
      metrics,
      logs,
    }
  })
}

function buildRoleLogs(events: RunEvent[], role: RolePanelRole, t: UiTexts): LogItem[] {
  return buildLogItems(events, t).filter((item) => item.body.toLowerCase().includes(role) || item.title.toLowerCase().includes(role))
}

function roleStatus(
  events: RunEvent[],
  role: RolePanelRole,
  trace: RoleTrace | undefined,
  messages: Array<{ content: string; timestamp: string }>,
  logs: LogItem[]
): string {
  if (logs.some((log) => log.level === "error")) {
    return "failed"
  }
  const latestNode = [...events].reverse().find(
    (event) =>
      (event.type === "node.started" || event.type === "node.completed" || event.type === "node.failed") &&
      event.nodeId === role
  )
  if (latestNode?.type === "node.started") return "running"
  if (latestNode?.type === "node.completed") return "done"
  if (latestNode?.type === "node.failed") return "failed"
  if (trace || messages.length) return "active"
  return "idle"
}

function rolePreview(
  role: RolePanelRole,
  trace: RoleTrace | undefined,
  messages: Array<{ content: string; timestamp: string }>,
  logs: LogItem[],
  t: UiTexts
): string {
  if (trace?.role === "planner") {
    return trace.simulationDirection || trace.conflictDynamics || trace.coreSituation
  }
  if (trace?.role === "coordinator") {
    return trace.outcomeDirection || trace.interactionPolicy || trace.runtimeFrame
  }
  if (trace?.intent) return trace.intent
  if (trace?.action) return trace.action
  if (trace?.thought) return trace.thought
  const latestMessage = messages.at(-1)?.content
  if (latestMessage) return latestMessage
  const latestLog = logs.at(-1)?.body
  if (latestLog) return latestLog
  return `${roleLabel(role)} ${t.roleNoSignal}`
}

function buildRoleSections(
  role: RolePanelRole,
  trace: RoleTrace | undefined,
  messages: Array<{ content: string; timestamp: string }>
): TraceEntry[] {
  const liveEntries = liveTraceEntries(role, messages)
  if (trace) {
    return traceEntries(trace).map((entry) => ({
      ...entry,
      content: entry.content || liveEntries.find((liveEntry) => liveEntry.step === entry.step)?.content || "",
    }))
  }
  return liveEntries
}

function traceEntries(trace: RoleTrace): TraceEntry[] {
  if (trace.role === "planner") {
    return PLANNER_TRACE_STEPS.map((step) => ({
      step,
      label: traceStepLabel(step),
      content: cleanTraceContent(trace[step], step, trace.role),
    }))
  }
  if (trace.role === "coordinator") {
    return COORDINATOR_TRACE_STEPS.map((step) => ({
      step,
      label: traceStepLabel(step),
      content: cleanTraceContent(trace[step], step, trace.role),
    }))
  }
  return STANDARD_TRACE_STEPS.map((step) => ({
    step,
    label: traceStepLabel(step),
    content: cleanTraceContent(trace[step], step, trace.role),
  }))
}

function liveTraceEntries(role: RolePanelRole, messages: Array<{ content: string; timestamp: string }>): TraceEntry[] {
  const entries = new Map<string, TraceEntry>()
  for (const message of messages) {
    const parsed = parseLiveTraceMessage(role, message.content)
    if (parsed) {
      entries.set(parsed.step, parsed)
    }
  }
  const orderedSteps = roleTraceSteps(role)
  return [
    ...orderedSteps.flatMap((step) => {
      const entry = entries.get(step)
      return entry ? [entry] : []
    }),
    ...[...entries.values()].filter((entry) => !orderedSteps.includes(entry.step as TraceStep)),
  ]
}

function parseLiveTraceMessage(role: RolePanelRole, content: string): TraceEntry | undefined {
  const match = content.match(/^\s*([^:：]+)\s*[:：]\s*([\s\S]+)$/)
  if (!match) {
    return undefined
  }
  const rawStep = match[1]?.trim()
  const rawContent = match[2]?.trim()
  if (!rawStep || !rawContent) {
    return undefined
  }
  const step = normalizeTraceStep(rawStep, role)
  return {
    step,
    label: traceStepLabel(step),
    content: cleanTraceContent(rawContent, step, role),
  }
}

function normalizeTraceStep(value: string, role: RolePanelRole): string {
  const compact = value.replace(/\s+/g, "").toLowerCase()
  const step = roleTraceSteps(role).find((candidate) => {
    const label = traceStepLabel(candidate).replace(/\s+/g, "").toLowerCase()
    return candidate.toLowerCase() === compact || label === compact
  })
  return step ?? value
}

function roleTraceSteps(role: RolePanelRole): TraceStep[] {
  if (role === "planner") return [...PLANNER_TRACE_STEPS]
  if (role === "coordinator") return [...COORDINATOR_TRACE_STEPS]
  return [...STANDARD_TRACE_STEPS]
}

function traceStepLabel(step: string): string {
  if (step === "coreSituation") return "Core Situation"
  if (step === "actorPressures") return "Actor Pressures"
  if (step === "conflictDynamics") return "Conflict Dynamics"
  if (step === "simulationDirection") return "Simulation Direction"
  if (step === "runtimeFrame") return "Runtime Frame"
  if (step === "actorRouting") return "Actor Routing"
  if (step === "interactionPolicy") return "Interaction Policy"
  if (step === "outcomeDirection") return "Outcome Direction"
  if (step === "thought") return "Thought"
  if (step === "target") return "Target"
  if (step === "action") return "Action"
  if (step === "intent") return "Intent"
  return humanizeTraceStep(step)
}

function cleanTraceContent(content: string, step: string, role?: string): string {
  const trimmed = content.trim()
  const label = traceStepLabel(step)
  const aliases = [
    step,
    label,
    label.replace(/\s+/g, ""),
    role ? `${role} ${step}` : "",
    role ? `${role} ${label}` : "",
    role ? `${roleLabel(role as RolePanelRole)} ${label}` : "",
  ].filter(Boolean)
  return aliases.reduce((value, alias) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return value.replace(new RegExp(`^\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"), "")
  }, trimmed)
}

function humanizeTraceStep(step: string): string {
  return step
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function countMetricSamples(events: RunEvent[]): number {
  return events.filter((event) => event.type === "model.metrics").length
}

function EmptyActivity({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/80 bg-muted/30 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  )
}

function roleLabel(role: RolePanelRole): string {
  if (role === "planner") return "Planner"
  if (role === "generator") return "Generator"
  if (role === "coordinator") return "Coordinator"
  if (role === "observer") return "Observer"
  return "Repair"
}

function roleDescription(role: RolePanelRole, t: UiTexts): string {
  if (role === "planner") return t.roleDescriptionPlanner
  if (role === "generator") return t.roleDescriptionGenerator
  if (role === "coordinator") return t.roleDescriptionCoordinator
  if (role === "observer") return t.roleDescriptionObserver
  return t.roleDescriptionRepair
}

function logToneClass(level: LogItem["level"]): string {
  if (level === "warn") return "bg-[#fff7ed] text-[#9a3412]"
  if (level === "error") return "bg-[#fff1f4] text-[#9f1239]"
  return "bg-muted text-muted-foreground"
}

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
