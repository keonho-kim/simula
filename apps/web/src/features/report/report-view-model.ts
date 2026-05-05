import type { ActorState, ModelRole, RunEvent, SimulationState } from "@simula/shared"
import type { UiTexts } from "@/lib/i18n"

export type ActorFilter = "all" | string
export type ReportSystemRole = Exclude<ModelRole, "storyBuilder">

export interface ReportActorOption {
  id: string
  name: string
  role: string
  interactionCount: number
}

export interface ReportTimelineItem {
  id: string
  roundIndex: number
  sourceActorId: string
  sourceName: string
  targetActorIds: string[]
  targetNames: string[]
  actionType: string
  visibility: string
  decisionType: string
  content: string
  intent: string
  expectation: string
}

export interface ReportTimelineRound {
  roundIndex: number
  elapsedTime: string
  preRound: string
  title: string
  roundSummary: string
  interactions: ReportTimelineItem[]
}

export interface RoleDiagnosticSummary {
  role: ReportSystemRole
  label: string
  status: string
  messageCount: number
  metricCount: number
  logCount: number
  nodeEventCount: number
  latestSignal: string
}

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

export function buildActorOptions(state: SimulationState | undefined): ReportActorOption[] {
  if (!state) {
    return []
  }
  return state.actors.map((actor) => ({
    id: actor.id,
    name: actor.name,
    role: actor.role,
    interactionCount: state.interactions.filter((interaction) => includesActor(interaction, actor.id)).length,
  }))
}

export function buildReportTimeline(
  state: SimulationState | undefined,
  actorFilter: ActorFilter = "all",
  t?: UiTexts
): ReportTimelineRound[] {
  if (!state) {
    return []
  }

  const actorNames = buildActorNameMap(state.actors)
  const filteredInteractions = state.interactions.filter((interaction) =>
    actorFilter === "all" || includesActor(interaction, actorFilter)
  )
  const rounds = new Map<number, ReportTimelineRound>()

  for (const interaction of filteredInteractions) {
    const round = ensureRound(rounds, state, interaction.roundIndex, t)
    round.interactions.push({
      id: interaction.id,
      roundIndex: interaction.roundIndex,
      sourceActorId: interaction.sourceActorId,
      sourceName: actorNames.get(interaction.sourceActorId) ?? interaction.sourceActorId,
      targetActorIds: interaction.targetActorIds,
      targetNames: interaction.targetActorIds.map((actorId) => actorNames.get(actorId) ?? actorId),
      actionType: interaction.actionType,
      visibility: interaction.visibility,
      decisionType: interaction.decisionType,
      content: interaction.content,
      intent: interaction.intent,
      expectation: interaction.expectation,
    })
  }

  if (actorFilter === "all") {
    for (const digest of state.roundDigests) {
      ensureRound(rounds, state, digest.roundIndex, t)
    }
    for (const report of state.roundReports) {
      ensureRound(rounds, state, report.roundIndex, t)
    }
  }

  return [...rounds.values()]
    .filter((round) => actorFilter === "all" || round.interactions.length > 0)
    .sort((a, b) => a.roundIndex - b.roundIndex)
}

export function buildRoleDiagnostics(events: RunEvent[], t?: UiTexts): {
  summaries: RoleDiagnosticSummary[]
  events: RoleDiagnosticEvent[]
} {
  const diagnosticEvents = events.flatMap((event, index) => diagnosticEventsForRunEvent(event, index, t))
  const summaries = REPORT_SYSTEM_ROLES.map((role) => {
    const roleEvents = diagnosticEvents.filter((event) => event.role === role)
    const latest = roleEvents.at(-1)
    const failed = roleEvents.some((event) => event.title.toLowerCase().includes("failed"))
    const running = roleEvents.some((event) => event.title.toLowerCase().includes("started"))
    return {
      role,
      label: roleLabel(role),
      status: failed ? "failed" : running ? "active" : roleEvents.length ? "done" : "idle",
      messageCount: roleEvents.filter((event) => event.kind === "message").length,
      metricCount: roleEvents.filter((event) => event.kind === "metric").length,
      logCount: roleEvents.filter((event) => event.kind === "log").length,
      nodeEventCount: roleEvents.filter((event) => event.kind === "node").length,
      latestSignal: latest?.body ?? t?.noDiagnosticSignal ?? "No diagnostic signal captured.",
    }
  })
  return { summaries, events: diagnosticEvents }
}

export function roleLabel(role: ReportSystemRole): string {
  if (role === "planner") return "Planner"
  if (role === "generator") return "Generator"
  if (role === "coordinator") return "Coordinator"
  if (role === "actor") return "Actor"
  if (role === "observer") return "Observer"
  return "Repair"
}

function ensureRound(
  rounds: Map<number, ReportTimelineRound>,
  state: SimulationState,
  roundIndex: number,
  t?: UiTexts
): ReportTimelineRound {
  const current = rounds.get(roundIndex)
  if (current) {
    return current
  }
  const digest = state.roundDigests.find((item) => item.roundIndex === roundIndex)
  const report = state.roundReports.find((item) => item.roundIndex === roundIndex)
  const round = {
    roundIndex,
    elapsedTime: digest?.preRound.elapsedTime ?? "",
    preRound: digest?.preRound.content ?? "",
    title: report?.title ?? `${t?.round ?? "Round"} ${roundIndex}`,
    roundSummary: report?.roundSummary ?? "",
    interactions: [],
  }
  rounds.set(roundIndex, round)
  return round
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
      body: `${event.metrics.totalTokens.toLocaleString()} ${t?.metricTotalTokens ?? "tokens"}, ${event.metrics.durationMs}ms ${t?.metricDuration ?? "duration"}, attempt ${event.metrics.attempt}.`,
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

function buildActorNameMap(actors: ActorState[]): Map<string, string> {
  return new Map(actors.map((actor) => [actor.id, actor.name]))
}

function includesActor(
  interaction: Pick<ReportTimelineItem, "sourceActorId" | "targetActorIds">,
  actorId: string
): boolean {
  return interaction.sourceActorId === actorId || interaction.targetActorIds.includes(actorId)
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
