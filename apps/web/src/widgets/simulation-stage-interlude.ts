import type { ModelRole, RunEvent } from "@simula/shared"
import type { UiTexts } from "@/lib/i18n"

const ACTOR_CARD_STEPS = new Set(["role", "backgroundHistory", "personality", "preference"])
const ROLE_NODE_IDS = new Set(["planner", "generator", "coordinator", "observer"])
const INTERLUDE_STAGES: Array<{ id: InterludeStageId; label: string }> = [
  { id: "planner", label: "Planner" },
  { id: "generator", label: "Generator" },
  { id: "actorCards", label: "Actor Cards" },
  { id: "coordinator", label: "Coordinator" },
  { id: "observer", label: "Observer" },
]

export type InterludeStageId = "planner" | "generator" | "actorCards" | "coordinator" | "observer"
export type InterludeStageStatus = "waiting" | "active" | "done"

export interface InterludeStage {
  id: InterludeStageId
  label: string
  status: InterludeStageStatus
}

export interface InterludeStageDetail {
  id: string
  stageId: InterludeStageId
  title: string
  stepLabel: string
  message: string
  roundIndex?: number
}

export interface SimulationInterludeState {
  title: string
  roleLabel: string
  stepLabel: string
  message: string
  actorCardProgress?: string
  activeStageId?: InterludeStageId
  stages: InterludeStage[]
  details: InterludeStageDetail[]
}

export function buildSimulationInterlude(events: RunEvent[], t?: UiTexts): SimulationInterludeState | undefined {
  const runStartedIndex = lastIndexOf(events, (event) => event.type === "run.started")
  if (runStartedIndex < 0) {
    return undefined
  }

  const scopedEvents = events.slice(runStartedIndex)
  if (scopedEvents.some((event) => event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled")) {
    return undefined
  }

  const actorsReadyIndex = lastIndexOf(scopedEvents, (event) => event.type === "actors.ready")
  const latestActorActionIndex = lastIndexOf(scopedEvents, isActorActionMessage)
  const latestRoundCompletedIndex = lastIndexOf(scopedEvents, (event) => event.type === "round.completed")
  const shouldShow =
    actorsReadyIndex < 0 ||
    latestActorActionIndex < 0 ||
    latestRoundCompletedIndex > latestActorActionIndex

  if (!shouldShow) {
    return undefined
  }

  const boundaryIndex = Math.max(0, latestRoundCompletedIndex)
  const signal = latestInterludeSignal(scopedEvents, boundaryIndex, t)
  const actorCardProgress = buildActorCardProgress(scopedEvents, t)
  const stageView = buildInterludeStageView(scopedEvents, t)
  return {
    title: interludeTitle(signal.role, actorsReadyIndex >= 0, t),
    roleLabel: roleLabel(signal.role),
    stepLabel: signal.stepLabel,
    message: signal.message,
    actorCardProgress,
    activeStageId: stageView.activeStageId,
    stages: stageView.stages,
    details: stageView.details,
  }
}

export function buildInterludeStageView(
  events: RunEvent[],
  t?: UiTexts
): { activeStageId?: InterludeStageId; stages: InterludeStage[]; details: InterludeStageDetail[] } {
  const completed = new Set<InterludeStageId>()
  const seen = new Set<InterludeStageId>()
  const details: InterludeStageDetail[] = []
  let activeStageId: InterludeStageId | undefined

  events.forEach((event, index) => {
    const eventStage = stageIdFromEvent(event)
    if (eventStage) {
      seen.add(eventStage)
      activeStageId = eventStage
    }
    if (event.type === "node.completed") {
      const completedStage = stageIdFromNodeId(event.nodeId)
      if (completedStage) {
        completed.add(completedStage)
      }
    }
    if (event.type === "actors.ready") {
      completed.add("actorCards")
    }
    if (event.type === "round.completed") {
      completed.add("coordinator")
    }

    const detail = interludeDetailFromEvent(event, index, t)
    if (detail) {
      details.push(detail)
    }
  })

  if (!activeStageId) {
    activeStageId = "planner"
  }

  const activeIndex = INTERLUDE_STAGES.findIndex((stage) => stage.id === activeStageId)
  const stages = INTERLUDE_STAGES.map((stage, index) => {
    let status: InterludeStageStatus = "waiting"
    if (completed.has(stage.id) || (activeIndex >= 0 && index < activeIndex && seen.has(stage.id))) {
      status = "done"
    } else if (stage.id === activeStageId) {
      status = completed.has(stage.id) ? "done" : "active"
    }
    return { ...stage, status }
  })

  return {
    activeStageId,
    stages,
    details: details.reverse(),
  }
}

function latestInterludeSignal(events: RunEvent[], startIndex: number, t?: UiTexts): { role: ModelRole; stepLabel: string; message: string } {
  for (let index = events.length - 1; index >= startIndex; index -= 1) {
    const event = events[index]
    if (event.type === "model.message") {
      const parsed = parseModelMessageStep(event.content)
      return {
        role: event.role,
        stepLabel: parsed.step ? traceStepLabel(parsed.step) : t?.interludeThinking ?? "Thinking",
        message: parsed.content || event.content,
      }
    }
    if (event.type === "node.started" && ROLE_NODE_IDS.has(event.nodeId)) {
      return {
        role: event.nodeId as ModelRole,
        stepLabel: t?.interludeStarting ?? "Starting",
        message: `${event.label} ${t?.interludeReadingState ?? "is reading the current simulation state."}`,
      }
    }
    if (event.type === "node.completed" && ROLE_NODE_IDS.has(event.nodeId)) {
      return {
        role: event.nodeId as ModelRole,
        stepLabel: t?.interludeCompleted ?? "Completed",
        message: `${event.label} ${t?.interludeFinishedPass ?? "finished its pass and handed off the next stage."}`,
      }
    }
  }
  return {
    role: "planner",
    stepLabel: t?.interludeStarting ?? "Starting",
    message: t?.interludePreparingFirstPass ?? "The simulation run is preparing its first planning pass.",
  }
}

function buildActorCardProgress(events: RunEvent[], t?: UiTexts): string | undefined {
  const actorCards = new Map<string, Set<string>>()
  let actorsReady = false
  for (const event of events) {
    if (event.type === "actors.ready") {
      actorsReady = true
    }
    if (event.type !== "model.message" || event.role !== "generator") {
      continue
    }
    const match = event.content.match(/^actor-(\d+)\s+([^:：]+)\s*[:：]/)
    const actorIndex = match?.[1]
    const step = match?.[2]?.trim()
    if (!actorIndex || !step || !ACTOR_CARD_STEPS.has(step)) {
      continue
    }
    const steps = actorCards.get(actorIndex) ?? new Set<string>()
    steps.add(step)
    actorCards.set(actorIndex, steps)
  }
  if (actorsReady) {
    return t?.actorCardsReady ?? "ready"
  }
  const completedSteps = [...actorCards.values()].reduce((sum, steps) => sum + steps.size, 0)
  const stepUnit = completedSteps === 1 ? (t?.actorCardStepSingular ?? "step") : (t?.actorCardStepPlural ?? "steps")
  return completedSteps ? `${completedSteps} ${stepUnit}` : undefined
}

function interludeDetailFromEvent(event: RunEvent, index: number, t?: UiTexts): InterludeStageDetail | undefined {
  if (event.type === "model.message") {
    const parsed = parseModelMessageStep(event.content)
    const stageId = stageIdFromModelMessage(event)
    return {
      id: `model-${index}`,
      stageId,
      title: stageId === "actorCards" ? t?.actorCards ?? "Actor Cards" : roleLabel(event.role),
      stepLabel: parsed.step ? traceStepLabel(parsed.step) : t?.interludeThinking ?? "Thinking",
      message: parsed.content || event.content,
    }
  }
  if (event.type === "actors.ready") {
    return {
      id: `actors-ready-${index}`,
      stageId: "actorCards",
      title: t?.actorCards ?? "Actor Cards",
      stepLabel: t?.actorCardsReady ?? "ready",
      message: t?.interludeActorsReadyMessage?.replace("{count}", String(event.actors.length)) ?? `${event.actors.length} actor cards are ready.`,
    }
  }
  if (event.type === "round.completed") {
    return {
      id: `round-${event.roundIndex}`,
      stageId: "coordinator",
      title: `${t?.roundReadyTitle ?? "Round ready"} ${event.roundIndex}`,
      stepLabel: t?.roundReadyStep ?? "Waiting for confirmation",
      message: t?.roundReadyMessage ?? "Review the current network state before the next round begins.",
      roundIndex: event.roundIndex,
    }
  }
  return undefined
}

function stageIdFromEvent(event: RunEvent): InterludeStageId | undefined {
  if (event.type === "model.message") {
    return stageIdFromModelMessage(event)
  }
  if (event.type === "node.started" || event.type === "node.completed" || event.type === "node.failed") {
    return stageIdFromNodeId(event.nodeId)
  }
  if (event.type === "actors.ready") {
    return "actorCards"
  }
  if (event.type === "actor.message") {
    return "coordinator"
  }
  if (event.type === "round.completed") {
    return "coordinator"
  }
  return undefined
}

function stageIdFromModelMessage(event: Extract<RunEvent, { type: "model.message" }>): InterludeStageId {
  if (event.role === "generator" && isActorCardMessage(event.content)) {
    return "actorCards"
  }
  if (event.role === "planner") return "planner"
  if (event.role === "generator") return "generator"
  if (event.role === "coordinator") return "coordinator"
  if (event.role === "actor") return "coordinator"
  if (event.role === "observer") return "observer"
  return "coordinator"
}

function stageIdFromNodeId(nodeId: string): InterludeStageId | undefined {
  if (nodeId === "planner") return "planner"
  if (nodeId === "generator") return "generator"
  if (nodeId === "coordinator") return "coordinator"
  if (nodeId === "observer") return "observer"
  return undefined
}

function isActorCardMessage(content: string): boolean {
  const match = content.match(/^actor-\d+\s+([^:：]+)\s*[:：]/)
  const step = match?.[1]?.trim()
  return Boolean(step && ACTOR_CARD_STEPS.has(step))
}

function isActorActionMessage(event: RunEvent): boolean {
  if (event.type !== "model.message" || event.role !== "actor") {
    return false
  }
  return parseModelMessageStep(event.content).step.toLowerCase() === "action"
}

function parseModelMessageStep(content: string): { step: string; content: string } {
  const normalized = stripRolePrefix(content)
  const match = normalized.match(/^\s*(.+?)\s*[:：]\s*([\s\S]+)$/)
  const rawLabel = match?.[1]?.trim() ?? ""
  const message = stripRolePrefix(match?.[2]?.trim() ?? normalized.trim())
  const step = rawLabel.split(/\s+/).at(-1) ?? ""
  return { step, content: message }
}

function stripRolePrefix(content: string): string {
  return content
    .replace(/^\s*(?:Planner|Generator|Coordinator|Observer|Actor|Repair)\s*[:：]\s*/i, "")
    .trim()
}

function interludeTitle(role: ModelRole, actorsReady: boolean, t?: UiTexts): string {
  if (role === "actor") return t?.interludeActorPreparing ?? "Actors are preparing their move"
  if (role === "coordinator") return actorsReady ? t?.interludeCoordinatorSettingRound ?? "Coordinator is setting the round" : t?.interludeCoordinatorPreparing ?? "Coordinator is preparing the run"
  if (role === "generator") return t?.interludeGeneratorCasting ?? "Generator is casting the world"
  if (role === "planner") return t?.interludePlannerShaping ?? "Planner is shaping the story"
  if (role === "observer") return t?.interludeObserverReading ?? "Observer is reading the outcome"
  return t?.interludeSimulationPreparing ?? "Simulation is preparing"
}

function roleLabel(role: ModelRole): string {
  if (role === "planner") return "Planner"
  if (role === "generator") return "Generator"
  if (role === "coordinator") return "Coordinator"
  if (role === "observer") return "Observer"
  if (role === "actor") return "Actor"
  if (role === "repair") return "Repair"
  return "Simulation"
}

function traceStepLabel(step: string): string {
  return step
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index
    }
  }
  return -1
}
