import type { RoleTrace, RunEvent, SimulationState } from "@simula/shared"
import type { UiTexts } from "@/lib/i18n"
import {
  COORDINATOR_TRACE_STEPS,
  PLANNER_TRACE_STEPS,
  ROLE_BUTTONS,
  STANDARD_TRACE_STEPS,
  type LogItem,
  type RolePanelRole,
  type RoleStatus,
  type RoleSummary,
  type TraceEntry,
  type TraceStep,
} from "./types"

export function buildLogItems(events: RunEvent[], t: UiTexts): LogItem[] {
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
    if (event.type === "run.canceled") {
      return [{ id, level: "warn", title: t.runCanceledLogTitle, body: "canceled", timestamp: event.timestamp }]
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

export function buildRoleSummaries(events: RunEvent[], runState: SimulationState | undefined, t: UiTexts): RoleSummary[] {
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

export function countMetricSamples(events: RunEvent[]): number {
  return events.filter((event) => event.type === "model.metrics").length
}

export function formatRoleStatus(status: RoleStatus, t: UiTexts): string {
  if (status === "idle") return t.statusIdle
  if (status === "active") return t.statusActive
  if (status === "running") return t.statusRunning
  if (status === "done") return t.statusDone
  return t.statusFailed
}

export function formatCount(count: number, label: string, t: UiTexts): string {
  if (isKoreanText(t)) {
    return `${label} ${count.toLocaleString()}개`
  }
  return `${count.toLocaleString()} ${label}`
}

export function roleLabel(role: RolePanelRole): string {
  if (role === "planner") return "Planner"
  if (role === "generator") return "Generator"
  if (role === "coordinator") return "Coordinator"
  if (role === "observer") return "Observer"
  return "Repair"
}

export function logToneClass(level: LogItem["level"]): string {
  if (level === "warn") return "bg-[#fff7ed] text-[#9a3412]"
  if (level === "error") return "bg-[#fff1f4] text-[#9f1239]"
  return "bg-muted text-muted-foreground"
}

export function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
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
): RoleStatus {
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
  _role: RolePanelRole,
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
  if (messages.length) return t.roleModelSignalCaptured
  if (logs.length) return t.roleLogSignalCaptured
  return t.roleNoSignal
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

function roleDescription(role: RolePanelRole, t: UiTexts): string {
  if (role === "planner") return t.roleDescriptionPlanner
  if (role === "generator") return t.roleDescriptionGenerator
  if (role === "coordinator") return t.roleDescriptionCoordinator
  if (role === "observer") return t.roleDescriptionObserver
  return t.roleDescriptionRepair
}

function isKoreanText(t: UiTexts): boolean {
  return t.languageKorean === "한국어"
}
