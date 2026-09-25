/**
 * Purpose: Project the visible context and output choices for role prompts.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/observer/prompts/round-summary.ts
 */
import type { PromptBlocks } from "@/backend/core/prompts/blocks"
import { compactLines, compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import type { Interaction, RoundReport } from "@/shared"

export function observerPromptContext(current: WorkflowState): PromptBlocks {
  const roundIndex = current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length
  const digest = current.simulation.roundDigests.find((item) => item.roundIndex === roundIndex)
  const event = current.simulation.plan?.majorEvents.find((item) => item.id === digest?.injectedEventId)
  const interactions = current.simulation.interactions.filter((item) => item.roundIndex === roundIndex)
  const previousReports = current.simulation.roundReports.filter((report) => report.roundIndex < roundIndex)
  const coordinator = current.simulation.roleTraces.find((trace) => trace.role === "coordinator")

  return { SIMULATION: [
    `Round: ${roundIndex}`,
    `Event: ${event ? `${event.title} (${event.status}). ${event.summary}` : "No new major event; actors continue from accumulated pressure."}`,
    `Pre-round cue: ${compactText(digest?.preRound.content ?? "No pre-round cue.", scalePromptLimit(280, current.scenario.controls))}`,
    `Round interactions:
${interactionLines(interactions, current)}`,
  ].join("\n"), CONSTRAINTS: [
    `Coordinator frame: ${coordinator?.role === "coordinator" ? compactText(coordinator.runtimeFrame, scalePromptLimit(260, current.scenario.controls)) : "None"}`,
    `Coordinator routing: ${coordinator?.role === "coordinator" ? compactText(coordinator.actorRouting, scalePromptLimit(260, current.scenario.controls)) : "None"}`,
    `Coordinator outcome: ${coordinator?.role === "coordinator" ? compactText(coordinator.outcomeDirection, scalePromptLimit(260, current.scenario.controls)) : "None"}`,
    `Coordinator event resolution: ${coordinator?.role === "coordinator" ? compactText(coordinator.eventResolution, scalePromptLimit(160, current.scenario.controls)) : "None"}`,
    `Coordinator progress decision: ${coordinator?.role === "coordinator" ? compactText(coordinator.progressDecision, scalePromptLimit(160, current.scenario.controls)) : "None"}`,
  ].join("\n"), ANALYSIS: `Previous observer summaries:\n${previousObserverLines(previousReports, current)}` }
}

function previousObserverLines(reports: RoundReport[], current: WorkflowState): string {
  if (!reports.length) {
    return "- None"
  }
  return compactLines(
    reports.slice(-3).map((report) => `- R${report.roundIndex}: ${report.roundSummary}`),
    3,
    scalePromptLimit(700, current.scenario.controls)
  )
}

function interactionLines(interactions: Interaction[], current: WorkflowState): string {
  if (!interactions.length) {
    return "- None"
  }
  const actorNames = new Map(current.simulation.actors.map((actor) => [actor.id, actor.name]))
  return compactLines(
    interactions.map((interaction) => {
      const source = actorNames.get(interaction.sourceActorId) ?? interaction.sourceActorId
      const targets = interaction.targetActorIds.map((id) => actorNames.get(id) ?? id).join(", ") || "self"
      return `- ${source} -> ${targets} (${interaction.visibility}, ${interaction.decisionType}): ${interaction.content} Intent: ${interaction.intent}`
    }),
    10,
    scalePromptLimit(1400, current.scenario.controls)
  )
}
