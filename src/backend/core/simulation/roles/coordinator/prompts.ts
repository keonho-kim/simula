/**
 * Purpose: Build bounded coordinator prompts for framing and event decisions.
 * Pattern: Prompt builder.
 * Usage: Consumed by coordinator graph and round invocation modules.
 * Related: src/backend/core/simulation/roles/coordinator/invocation.ts
 */
import type { CoordinatorTraceStep } from "@/shared"
import { compactLines, compactPlannerDigest, compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"

export type CoordinatorPromptBuilder = (
  state: WorkflowState,
  partial: Partial<Record<CoordinatorTraceStep, string>>
) => string

export const coordinatorPrompts: Record<Exclude<CoordinatorTraceStep, "progressDecision">, CoordinatorPromptBuilder> = {
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
    const injectableEvents =
      current.simulation.plan?.majorEvents.filter((event) => event.status === "pending" || event.status === "partial") ?? []
    const eventLines = injectableEvents.length
      ? injectableEvents.map((event) => `- ${event.id} (${event.status}): ${event.title}. ${event.summary}`).join("\n")
      : "- None"
    const recentInteractions = current.simulation.interactions
      .filter((interaction) => interaction.roundIndex >= Math.max(1, roundIndex - 2))
      .map((interaction) => `- R${interaction.roundIndex} ${interaction.content} Intent: ${interaction.intent}`)
      .slice(-8)
    const recentDigests = current.simulation.roundDigests.slice(-2).map((digest) => {
      const injectedEvent = current.simulation.plan?.majorEvents.find((event) => event.id === digest.injectedEventId)
      const eventLabel = injectedEvent ? `${injectedEvent.title}. ${injectedEvent.summary}` : "None"
      const report = current.simulation.roundReports.find((item) => item.roundIndex === digest.roundIndex)
      return `- R${digest.roundIndex} injected event: ${eventLabel}; cue: ${digest.preRound.content}; observer: ${report?.roundSummary ?? "None"}`
    })
    return `Coordinator eventInjection.
Choose one pending or partial event id, or None.
Return exactly one allowed output: an event id from the list, or None.
No explanation, titles, markdown, or punctuation.

Current round: ${roundIndex}
Max round: ${current.scenario.controls.maxRound}
Available events:
${eventLines}
Recent interactions:
${recentInteractions.length ? compactLines(recentInteractions, 8, scalePromptLimit(900, current.scenario.controls)) : "- None"}
Recent digests:
${recentDigests.length ? compactLines(recentDigests, 2, scalePromptLimit(500, current.scenario.controls)) : "- None"}`
  },
  eventResolution: (current) => {
    const roundIndex = current.simulation.roundDigests.length
    const activeEvent = current.simulation.plan?.majorEvents.find((event) => event.status === "active")
    const recentInteractions = current.simulation.interactions
      .filter((interaction) => interaction.roundIndex === roundIndex)
      .map((interaction) => `- ${interaction.content} Intent: ${interaction.intent}`)
      .slice(-10)
    return `Coordinator eventResolution.
Return exactly one allowed output: completed or partial.
Use completed only when the event's core pressure, decision, responsibility, or next state was substantially addressed this round.
Use partial when actors only reacted, deferred responsibility, left conditions unresolved, or the event should continue into another round.
No explanation or markdown.

Event: ${activeEvent ? `${activeEvent.id}: ${activeEvent.title}. ${activeEvent.summary}` : "None"}
Current round: ${roundIndex}
Round interactions:
${recentInteractions.length ? compactLines(recentInteractions, 10, scalePromptLimit(1000, current.scenario.controls)) : "- None"}`
  },
}
