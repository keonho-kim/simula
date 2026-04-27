import type { ActorState, Interaction, PlannedEvent, SimulationState } from "@simula/shared"

export function renderReport(state: SimulationState): string {
  const plan = state.plan
  const eventRows = (plan?.majorEvents ?? [])
    .map((event) => `| ${event.title} | ${event.status} | ${event.summary} |`)
    .join("\n")
  const actorRows = state.actors
    .map((actor) => `| ${actor.name} | ${actor.role} | ${actor.intent} |`)
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
    `## Background Story`,
    state.plan?.backgroundStory ?? state.plan?.interpretation ?? "No background story was recorded.",
    ``,
    `## Actor Results`,
    `| Actor | Role | Final Intent |`,
    `| --- | --- | --- |`,
    actorRows || `| No actors | - | - |`,
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
      const semiPublic = Object.values(actor.context.semiPublic).flat()
      const privateItems = Object.values(actor.context.private).flat()
      return [
        `### ${actor.name}`,
        `- Public: ${actor.context.public.length}`,
        `- Semi-public: ${semiPublic.length}`,
        `- Private: ${privateItems.length}`,
        `- Solitary: ${actor.context.solitary.length}`,
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
  return `${completed}/${events.length} major events completed.`
}
