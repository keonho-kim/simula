/**
 * Purpose: Build the coordinator event-resolution model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactLines, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { CoordinatorPromptBuilder } from "./contracts"

export const eventResolution: CoordinatorPromptBuilder = (current) => {
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

${renderPromptBlock("SIMULATION", `Event: ${activeEvent ? `${activeEvent.id}: ${activeEvent.title}. ${activeEvent.summary}` : "None"}
Current round: ${roundIndex}
Round interactions:
${recentInteractions.length ? compactLines(recentInteractions, 10, scalePromptLimit(1000, current.scenario.controls)) : "- None"}`)}`
  }
