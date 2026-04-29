import type { CoordinatorTraceStep } from "@simula/shared"
import { compactLines, compactPlannerDigest, compactText, renderOutputLengthGuide, scalePromptLimit } from "../../../prompt"
import type { WorkflowState } from "../../state"

export type CoordinatorPromptBuilder = (
  state: WorkflowState,
  partial: Partial<Record<CoordinatorTraceStep, string>>
) => string

export const coordinatorPrompts: Record<CoordinatorTraceStep, CoordinatorPromptBuilder> = {
  runtimeFrame: (current) =>
    `Coordinator runtimeFrame. Return 2 short sentences on communication structure, timing pressure, and interaction chain.
${renderOutputLengthGuide(current.scenario.controls, "coordinator frame")}

Digest:
${compactPlannerDigest(current.simulation.plan, current.scenario.text, scalePromptLimit(900, current.scenario.controls))}`,
  actorRouting: (current, partial) =>
    `Coordinator actorRouting. Return 2 short sentences on which pressures should interact. Do not pick one target.
${renderOutputLengthGuide(current.scenario.controls, "coordinator routing")}

Frame: ${compactText(partial.runtimeFrame, scalePromptLimit(350, current.scenario.controls))}
Actors:
${compactLines(current.simulation.actors.map((actor) => `- ${actor.name} (${actor.role}): ${actor.preference}`), 10, scalePromptLimit(900, current.scenario.controls))}`,
  interactionPolicy: (current, partial) =>
    `Coordinator interactionPolicy. Return 2 short sentences for public, semi-public, private, solitary boundaries.
${renderOutputLengthGuide(current.scenario.controls, "interaction policy")}

Frame: ${compactText(partial.runtimeFrame, scalePromptLimit(300, current.scenario.controls))}
Routing: ${compactText(partial.actorRouting, scalePromptLimit(350, current.scenario.controls))}`,
  outcomeDirection: (current, partial) =>
    `Coordinator outcomeDirection. Return 2 short sentences naming end-state pressure without resolving it.
${renderOutputLengthGuide(current.scenario.controls, "outcome direction")}

Frame: ${compactText(partial.runtimeFrame, scalePromptLimit(250, current.scenario.controls))}
Routing: ${compactText(partial.actorRouting, scalePromptLimit(250, current.scenario.controls))}
Policy: ${compactText(partial.interactionPolicy, scalePromptLimit(250, current.scenario.controls))}`,
  eventInjection: (current) => {
    const roundIndex = current.simulation.roundDigests.length + 1
    const pendingEvents = current.simulation.plan?.majorEvents.filter((event) => event.status === "pending") ?? []
    const eventLines = pendingEvents.length
      ? pendingEvents.map((event) => `- ${event.id}: ${event.title}. ${event.summary}`).join("\n")
      : "- None"
    const recentInteractions = current.simulation.interactions
      .filter((interaction) => interaction.roundIndex >= Math.max(1, roundIndex - 2))
      .map((interaction) => `- R${interaction.roundIndex} ${interaction.content} Intent: ${interaction.intent}`)
      .slice(-8)
    const recentDigests = current.simulation.roundDigests.slice(-2).map((digest) => {
      const injectedEvent = current.simulation.plan?.majorEvents.find((event) => event.id === digest.injectedEventId)
      const eventLabel = injectedEvent ? `${injectedEvent.title}. ${injectedEvent.summary}` : "None"
      return `- R${digest.roundIndex} injected event: ${eventLabel}; digest: ${digest.preRound.content}`
    })
    return `Coordinator eventInjection.
Choose one pending event id or None.
Return exactly one allowed output: an event id from the list, or None.
No explanation, titles, markdown, or punctuation.

Current round: ${roundIndex}
Max round: ${current.scenario.controls.maxRound}
Pending events:
${eventLines}
Recent interactions:
${recentInteractions.length ? compactLines(recentInteractions, 8, scalePromptLimit(900, current.scenario.controls)) : "- None"}
Recent digests:
${recentDigests.length ? compactLines(recentDigests, 2, scalePromptLimit(500, current.scenario.controls)) : "- None"}`
  },
  progressDecision: (current) => {
    const roundIndex = current.simulation.roundDigests.length
    const recentInteractions = current.simulation.interactions
      .filter((interaction) => interaction.roundIndex >= Math.max(1, roundIndex - 1))
      .map((interaction) => `- R${interaction.roundIndex} ${interaction.content} Intent: ${interaction.intent}`)
      .slice(-8)
    return `Coordinator progressDecision.
Return exactly one allowed output: continue, stop, or complete.
Be generous; one quiet round is not enough to stop.
No explanation or markdown.

Current round: ${roundIndex}
Max round: ${current.scenario.controls.maxRound}
Recent interactions:
${recentInteractions.length ? compactLines(recentInteractions, 8, scalePromptLimit(900, current.scenario.controls)) : "- None"}`
  },
  extensionDecision: (current) =>
    `Coordinator extensionDecision.
Return exactly one allowed output: continue or stop.
No explanation or markdown.

Current round: ${current.simulation.roundDigests.length}
Current max round: ${current.scenario.controls.maxRound}
World: ${compactText(current.simulation.worldSummary, scalePromptLimit(700, current.scenario.controls))}
Pending events: ${(current.simulation.plan?.majorEvents.filter((event) => event.status === "pending").length ?? 0)}`,
}
