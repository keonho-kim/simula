import type { CoordinatorTraceStep } from "@simula/shared"
import type { WorkflowState } from "../../state"
import { plannerDigestSummary } from "../../plan"

export type CoordinatorPromptBuilder = (
  state: WorkflowState,
  partial: Partial<Record<CoordinatorTraceStep, string>>
) => string

export const coordinatorPrompts: Record<CoordinatorTraceStep, CoordinatorPromptBuilder> = {
  runtimeFrame: (current) =>
    `Coordinator runtime frame. In one short paragraph, define how runtime interactions should unfold from the planner scenario digest.
Focus on communication structure, strategic contradictions, timing pressure, and the kind of interaction chain actors should produce.

Planner scenario digest:
${plannerDigestSummary(current.simulation.plan, current.scenario.text)}`,
  actorRouting: (current, partial) =>
    `Coordinator actor routing. In one compact paragraph, describe which actor pressures should interact across rounds.
Do not choose a single target. Route all relevant actors according to their roles and the planner digest.

Runtime frame: ${partial.runtimeFrame}
Actors:
${current.simulation.actors.map((actor) => `- ${actor.name} (${actor.role}): ${actor.preference}`).join("\n")}`,
  interactionPolicy: (_current, partial) =>
    `Coordinator interaction policy. In one compact paragraph, set the rules for public, semi-public, private, and solitary interactions.
Respect information boundaries and explain how opaque communication or conflicting strategies should affect actor decisions.

Runtime frame: ${partial.runtimeFrame}
Actor routing: ${partial.actorRouting}`,
  outcomeDirection: (_current, partial) =>
    `Coordinator outcome direction. In one compact paragraph, define what kind of concrete runtime outcome the actors should converge toward.
Name the decision pressure or end-state options, but do not resolve the simulation in advance.

Runtime frame: ${partial.runtimeFrame}
Actor routing: ${partial.actorRouting}
Interaction policy: ${partial.interactionPolicy}`,
  eventInjection: (current) => {
    const roundIndex = current.simulation.roundDigests.length + 1
    const pendingEvents = current.simulation.plan?.majorEvents.filter((event) => event.status === "pending") ?? []
    const eventLines = pendingEvents.length
      ? pendingEvents.map((event) => `- ${event.id}: ${event.title}. ${event.summary}`).join("\n")
      : "- None"
    const recentInteractions = current.simulation.interactions
      .filter((interaction) => interaction.roundIndex >= Math.max(1, roundIndex - 2))
      .map((interaction) => `- R${interaction.roundIndex} ${interaction.content} Intent: ${interaction.intent}`)
    const recentDigests = current.simulation.roundDigests.slice(-2).map((digest) => {
      const injectedEvent = current.simulation.plan?.majorEvents.find((event) => event.id === digest.injectedEventId)
      const eventLabel = injectedEvent ? `${injectedEvent.title}. ${injectedEvent.summary}` : "None"
      return `- R${digest.roundIndex} injected event: ${eventLabel}; digest: ${digest.preRound.content}`
    })
    return `Coordinator event timing.
Choose whether one pending major event is appropriate for the current moment, or return None.
Return exactly one allowed output: an event id from the list, or None.
Do not explain. Do not use event titles. Do not use Markdown. Do not add punctuation.

Current round: ${roundIndex}
Max round: ${current.scenario.controls.maxRound}
Pending events:
${eventLines}
Recent interactions from the last two rounds:
${recentInteractions.length ? recentInteractions.join("\n") : "- None"}
Recent round digests and injected events:
${recentDigests.length ? recentDigests.join("\n") : "- None"}`
  },
  progressDecision: (current) => {
    const roundIndex = current.simulation.roundDigests.length
    const recentInteractions = current.simulation.interactions
      .filter((interaction) => interaction.roundIndex >= Math.max(1, roundIndex - 1))
      .map((interaction) => `- R${interaction.roundIndex} ${interaction.content} Intent: ${interaction.intent}`)
    return `Coordinator progress decision.
Judge whether the simulation should continue before max round is reached.
Be generous: do not stop for a single quiet or ambiguous round.
Return exactly one allowed output: continue, stop, or complete.
Do not explain. Do not use Markdown. Do not add punctuation.

Current round: ${roundIndex}
Max round: ${current.scenario.controls.maxRound}
Recent interactions:
${recentInteractions.length ? recentInteractions.join("\n") : "- None"}`
  },
  extensionDecision: (current) =>
    `Coordinator extension decision.
The run reached the current max round. Decide if the simulation needs more rounds.
Return exactly one allowed output: continue or stop.
Do not explain. Do not use Markdown. Do not add punctuation.

Scenario: ${current.scenario.text}
Current round: ${current.simulation.roundDigests.length}
Current max round: ${current.scenario.controls.maxRound}
World summary: ${current.simulation.worldSummary}
Pending events: ${(current.simulation.plan?.majorEvents.filter((event) => event.status === "pending").length ?? 0)}`,
}
