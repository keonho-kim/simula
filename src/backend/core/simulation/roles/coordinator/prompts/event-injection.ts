/**
 * Purpose: Build the coordinator event-injection model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactLines, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { CoordinatorPromptBuilder } from "./contracts"

export const eventInjection: CoordinatorPromptBuilder = (current) => {
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

${renderPromptBlock("INFO", `Current round: ${roundIndex}
Max round: ${current.scenario.controls.maxRound}`)}

${renderPromptBlock("OPTIONS", `Available events:
${eventLines}`)}

${renderPromptBlock("SIMULATION", `Recent interactions:
${recentInteractions.length ? compactLines(recentInteractions, 8, scalePromptLimit(900, current.scenario.controls)) : "- None"}
Recent digests:
${recentDigests.length ? compactLines(recentDigests, 2, scalePromptLimit(500, current.scenario.controls)) : "- None"}`)}`
  }
