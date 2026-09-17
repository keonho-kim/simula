import type { ModelRole, RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"

export type ReportSystemRole = Exclude<ModelRole, "storyBuilder">

export interface RoleDiagnosticEvent {
  id: string
  role: ReportSystemRole
  timestamp: string
  kind: "node" | "message" | "metric" | "think" | "log"
  title: string
  body: string
  details?: string
}

export const REPORT_SYSTEM_ROLES: ReportSystemRole[] = [
  "planner",
  "generator",
  "coordinator",
  "actor",
  "observer",
  "repair",
]

export function buildRoleDiagnostics(events: RunEvent[], t?: UiTexts): RoleDiagnosticEvent[] {
  return events.flatMap((event, index) => diagnosticEventsForRunEvent(event, index, t))
}

export function roleLabel(role: ReportSystemRole, t?: UiTexts): string {
  if (role === "planner") return t?.rolePlanner ?? "Planner"
  if (role === "generator") return t?.roleGenerator ?? "Generator"
  if (role === "coordinator") return t?.roleCoordinator ?? "Coordinator"
  if (role === "actor") return t?.roleActor ?? "Actor"
  if (role === "observer") return t?.roleObserver ?? "Observer"
  return t?.roleRepair ?? "Repair"
}

function diagnosticEventsForRunEvent(event: RunEvent, index: number, t?: UiTexts): RoleDiagnosticEvent[] {
  if (event.type === "model.message") {
    if (!isReportSystemRole(event.role)) {
      return []
    }
    return [{
      id: `${event.type}-${index}`,
      role: event.role,
      timestamp: event.timestamp,
      kind: "message",
      title: t?.modelMessageLogTitle ?? "Model message",
      body: t?.modelMessageLogBody ?? "Model output was captured for this role.",
    }]
  }
  if (event.type === "model.metrics") {
    const role = event.metrics.role
    if (!isReportSystemRole(role)) {
      return []
    }
    return [{
      id: `${event.type}-${index}`,
      role,
      timestamp: event.timestamp,
      kind: "metric",
      title: `${event.metrics.step} metrics`,
      body: `${event.metrics.tokenSource === "provider" ? event.metrics.totalTokens.toLocaleString() : "—"} ${t?.metricTotalTokens ?? "tokens"}, ${event.metrics.durationMs}ms ${t?.metricDuration ?? "duration"}, attempt ${event.metrics.attempt}.`,
    }]
  }
  if (event.type === "model.reasoning") {
    if (!isReportSystemRole(event.role)) {
      return []
    }
    return [{
      id: `${event.type}-${index}`,
      role: event.role,
      timestamp: event.timestamp,
      kind: "think",
      title: `${event.step} think`,
      body: `${event.reasoningTokens.toLocaleString()} reasoning tokens, attempt ${event.attempt}.`,
      details: event.content,
    }]
  }
  if (event.type === "node.started" || event.type === "node.completed" || event.type === "node.failed") {
    const role = roleFromNode(event.nodeId, event.label)
    if (!role) {
      return []
    }
    return [{
      id: `${event.type}-${index}`,
      role,
      timestamp: event.timestamp,
      kind: "node",
      title: event.type.replace("node.", "Node "),
      body: event.type === "node.failed" ? event.error : event.label,
    }]
  }
  if (event.type === "log") {
    const role = roleFromText(event.message)
    if (!role) {
      return []
    }
    return [{
      id: `${event.type}-${index}`,
      role,
      timestamp: event.timestamp,
      kind: "log",
      title: event.level.toUpperCase(),
      body: event.message,
    }]
  }
  return []
}

function isReportSystemRole(role: ModelRole): role is ReportSystemRole {
  return REPORT_SYSTEM_ROLES.includes(role as ReportSystemRole)
}

function roleFromNode(nodeId: string, label: string): ReportSystemRole | undefined {
  return REPORT_SYSTEM_ROLES.find((role) => nodeId === role || normalizeRoleText(label).includes(role))
}

function roleFromText(text: string): ReportSystemRole | undefined {
  const normalized = normalizeRoleText(text)
  return REPORT_SYSTEM_ROLES.find((role) => normalized.includes(role))
}

function normalizeRoleText(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, " ")
}
