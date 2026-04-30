import type { ActorState, Interaction, PlannedEvent, SimulationState } from "@simula/shared"
import { plannerDigestSummary } from "./plan"

export function renderReport(state: SimulationState): string {
  const plan = state.plan
  const eventRows = (plan?.majorEvents ?? [])
    .map((event) => `| ${event.title} | ${event.status} | ${event.summary} |`)
    .join("\n")
  const actorRows = state.actors
    .map(
      (actor) =>
        `| ${actor.name} | ${actor.role} | ${actor.personality || "not recorded"} | ${actor.preference || "not recorded"} |`
    )
    .join("\n")
  const interactionRows = state.interactions
    .map((item) => {
      const actor = state.actors.find((candidate) => candidate.id === item.sourceActorId)
      return `- Round ${item.roundIndex}: ${actor?.name ?? item.sourceActorId} ${item.content}`
    })
    .join("\n")

  return [
    `# Simula Report`,
    ``,
    `## Conclusion`,
    state.worldSummary,
    ``,
    `## Scenario Digest`,
    plannerDigestSummary(state.plan, "No scenario digest was recorded."),
    ``,
    `## Actor Results`,
    `| Actor | Role | Personality | Preference |`,
    `| --- | --- | --- | --- |`,
    actorRows || `| No actors | - | - | - |`,
    ``,
    `## Actor Cards`,
    renderActorCards(state.actors),
    ``,
    `## Timeline`,
    interactionRows || `No interactions were adopted.`,
    ``,
    `## Round Digests`,
    renderRoundDigests(state),
    ``,
    `## Round Reports`,
    renderRoundReports(state),
    ``,
    `## Actor Dynamics`,
    renderActorDynamics(state.actors),
    ``,
    `## Actor Actions`,
    renderActorActions(state.actors),
    ``,
    `## Actor Context`,
    renderActorContexts(state.actors),
    ``,
    `## Role Traces`,
    renderRoleTraces(state.roleTraces),
    ``,
    `## Major Events`,
    `| Event | Status | Summary |`,
    `| --- | --- | --- |`,
    eventRows || `| No events | - | - |`,
    ``,
    `## Run Metadata`,
    `- Stop reason: ${state.stopReason || "not set"}`,
    `- Interactions: ${state.interactions.length}`,
    state.errors.length ? `- Errors: ${state.errors.join("; ")}` : `- Errors: none`,
  ].join("\n")
}

function renderActorCards(actors: ActorState[]): string {
  if (actors.length === 0) {
    return "No actor cards were generated."
  }
  return actors
    .map((actor) =>
      [
        `### ${actor.name}`,
        `- Role: ${actor.role}`,
        `- Background history: ${actor.backgroundHistory || "not recorded"}`,
        `- Personality: ${actor.personality || "not recorded"}`,
        `- Preference: ${actor.preference || "not recorded"}`,
      ].join("\n")
    )
    .join("\n\n")
}

function renderRoundReports(state: SimulationState): string {
  if (state.roundReports.length === 0) {
    return "No observer round reports were recorded."
  }
  return state.roundReports
    .map((report) =>
      [
        `### ${report.title}`,
        report.summary,
        `- Key interactions: ${report.keyInteractions.join("; ") || "none"}`,
        `- Actor impacts: ${report.actorImpacts.join("; ") || "none"}`,
        `- Unresolved questions: ${report.unresolvedQuestions.join("; ") || "none"}`,
      ].join("\n")
    )
    .join("\n\n")
}

function renderRoundDigests(state: SimulationState): string {
  if (state.roundDigests.length === 0) {
    return "No round digests were recorded."
  }
  return state.roundDigests
    .map((digest) =>
      [
        `### Round ${digest.roundIndex}`,
        `- Pre-round: ${digest.preRound.elapsedTime}. ${digest.preRound.content}`,
        `- After-round: ${digest.afterRound.content || "No after-round digest was recorded."}`,
      ].join("\n")
    )
    .join("\n\n")
}

function renderActorActions(actors: ActorState[]): string {
  if (actors.length === 0) {
    return "No actor actions were generated."
  }
  return actors
    .map((actor) => {
      const actions = actor.actions
        .map((action) => `  - ${action.visibility}: ${action.label}`)
        .join("\n")
      return [`### ${actor.name}`, actions || "  - No actions"].join("\n")
    })
    .join("\n\n")
}

function renderActorContexts(actors: ActorState[]): string {
  if (actors.length === 0) {
    return "No actor context was recorded."
  }
  return actors
    .map((actor) => {
      const counts = actor.context.visible.reduce<Record<string, number>>((current, entry) => {
        current[entry.kind] = (current[entry.kind] ?? 0) + 1
        return current
      }, {})
      return [
        `### ${actor.name}`,
        `- Events: ${counts.event ?? 0}`,
        `- Out: ${counts.out ?? 0}`,
        `- In: ${counts.in ?? 0}`,
        `- Observed: ${counts.observed ?? 0}`,
        `- Self: ${counts.self ?? 0}`,
      ].join("\n")
    })
    .join("\n\n")
}

function renderRoleTraces(traces: SimulationState["roleTraces"]): string {
  if (traces.length === 0) {
    return "No role traces were recorded."
  }
  return traces
    .map((trace) => {
      const retries = Object.entries(trace.retryCounts)
        .map(([step, count]) => `${step}: ${count}`)
        .join(", ")
      if (trace.role === "planner") {
        return [
          `### ${trace.role}`,
          `- Core situation: ${trace.coreSituation}`,
          `- Actor pressures: ${trace.actorPressures}`,
          `- Conflict dynamics: ${trace.conflictDynamics}`,
          `- Simulation direction: ${trace.simulationDirection}`,
          `- Retries: ${retries}`,
        ].join("\n")
      }
      if (trace.role === "coordinator") {
        return [
          `### ${trace.role}`,
          `- Runtime frame: ${trace.runtimeFrame}`,
          `- Actor routing: ${trace.actorRouting}`,
          `- Interaction policy: ${trace.interactionPolicy}`,
          `- Outcome direction: ${trace.outcomeDirection}`,
          `- Retries: ${retries}`,
        ].join("\n")
      }
      return [
        `### ${trace.role}`,
        `- Thought: ${trace.thought}`,
        `- Target: ${trace.target}`,
        `- Action: ${trace.action}`,
        `- Intent: ${trace.intent}`,
        `- Retries: ${retries}`,
      ].join("\n")
    })
    .join("\n\n")
}

function renderActorDynamics(actors: ActorState[]): string {
  if (actors.length === 0) {
    return "No actor dynamics were recorded."
  }
  return actors
    .map((actor) => {
      const relationships = Object.entries(actor.relationships)
        .map(([target, value]) => `${target}: ${value}`)
        .join(", ")
      return `- ${actor.name}: ${relationships || "no explicit relationship changes"}`
    })
    .join("\n")
}

export function summarizeInteractions(interactions: Interaction[]): string {
  if (interactions.length === 0) {
    return "The simulation did not adopt any interactions."
  }
  return `${interactions.length} interactions advanced the scenario across ${new Set(
    interactions.map((item) => item.roundIndex)
  ).size} rounds.`
}

export function summarizeEvents(events: PlannedEvent[]): string {
  const completed = events.filter((event) => event.status === "completed").length
  const partial = events.filter((event) => event.status === "partial").length
  const pending = events.filter((event) => event.status === "pending").length
  return `${completed}/${events.length} major events completed; ${partial} partial; ${pending} pending.`
}
