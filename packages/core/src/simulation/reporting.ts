import type { ActionVisibility, Interaction, PlannedEvent, SimulationState } from "@simula/shared"
import { calculateNetworkDynamics, type NetworkRelationshipMetric } from "./network-dynamics"
import { plannerDigestSummary } from "./plan"

export function renderReport(state: SimulationState): string {
  const plan = state.plan
  const dynamics = calculateNetworkDynamics(state)
  const latestRoundReport = state.roundReports.at(-1)
  const eventRows = (plan?.majorEvents ?? [])
    .map((event) => {
      const participants = event.participantIds
        .map((actorId) => state.actors.find((actor) => actor.id === actorId)?.name ?? actorId)
        .join(", ")
      return `| ${markdownCell(event.title)} | ${event.status} | ${markdownCell(participants || "none")} | ${markdownCell(event.summary)} |`
    })
    .join("\n")
  const actorRows = state.actors
    .map((actor) => {
      const metric = dynamics.actorMetrics.find((item) => item.actorId === actor.id)
      return `| ${markdownCell(actor.name)} | ${markdownCell(actor.role)} | ${markdownCell(actor.intent || "not recorded")} | ${metric?.uniqueCounterparties ?? 0} | ${metric?.weightedDegree ?? 0} |`
    })
    .join("\n")
  const actorMetricRows = dynamics.actorMetrics
    .map((metric) =>
      `| ${markdownCell(metric.actorName)} | ${metric.sentCount} | ${metric.receivedCount} | ${metric.weightedDegree} | ${metric.uniqueCounterparties} | ${roundRange(metric.firstActiveRound, metric.lastActiveRound)} | ${visibilityMixText(metric.visibilityMix)} |`
    )
    .join("\n")
  const relationshipRows = dynamics.relationshipMetrics
    .slice(0, 12)
    .map((relationship) =>
      `| ${markdownCell(`${relationship.sourceName} - ${relationship.targetName}`)} | ${relationship.totalWeight} | ${relationship.reciprocal ? "yes" : "no"} | ${directionCountsText(relationship)} | ${roundRange(relationship.firstRound, relationship.lastRound)} | ${visibilityMixText(relationship.visibilityMix)} |`
    )
    .join("\n")
  const roundRows = dynamics.roundMetrics
    .map((round) => {
      const digest = state.roundDigests.find((item) => item.roundIndex === round.roundIndex)
      const report = state.roundReports.find((item) => item.roundIndex === round.roundIndex)
      const summary = report?.roundSummary || digest?.preRound.content || "No round summary recorded."
      return `| ${round.roundIndex} | ${markdownCell(digest?.preRound.elapsedTime || "-")} | ${round.actionCount} | ${round.activeActorCount} | ${round.newTies} | ${markdownCell(round.strongestActorName ?? "none")} | ${markdownCell(summary)} |`
    })
    .join("\n")
  const completedEvents = (plan?.majorEvents ?? []).filter((event) => event.status === "completed").length
  const missedEvents = (plan?.majorEvents ?? []).filter((event) => event.status === "missed").length
  const partialEvents = (plan?.majorEvents ?? []).filter((event) => event.status === "partial").length

  return [
    `# Simula Report`,
    ``,
    `## Outcome`,
    state.worldSummary,
    latestRoundReport ? `\nLatest observed outcome: ${latestRoundReport.roundSummary}` : "",
    ``,
    `## Benchmark Summary`,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Scenario digest | ${markdownCell(plannerDigestSummary(state.plan, "No scenario digest was recorded."))} |`,
    `| Rounds completed | ${state.roundDigests.length} |`,
    `| Actors | ${state.actors.length} |`,
    `| Valid network actions | ${dynamics.summary.validActionCount} |`,
    `| Major events completed | ${completedEvents}/${plan?.majorEvents.length ?? 0} |`,
    `| Partial events | ${partialEvents} |`,
    `| Missed events | ${missedEvents} |`,
    `| Most central actor | ${markdownCell(dynamics.summary.mostCentralActor?.actorName ?? "none")} |`,
    `| Most active dyad | ${markdownCell(dynamics.summary.mostActiveDyad ? `${dynamics.summary.mostActiveDyad.sourceName} - ${dynamics.summary.mostActiveDyad.targetName}` : "none")} |`,
    `| Network concentration | ${formatPercent(dynamics.summary.networkConcentration)} |`,
    ``,
    `## Major Event Results`,
    `| Event | Status | Participants | Summary |`,
    `| --- | --- | --- | --- |`,
    eventRows || `| No events | - | - | - |`,
    ``,
    `## Network Dynamics`,
    renderNetworkSummary(dynamics),
    ``,
    `| Actor | Sent | Received | Weighted degree | Counterparties | Active rounds | Visibility mix |`,
    `| --- | ---: | ---: | ---: | ---: | --- | --- |`,
    actorMetricRows || `| No actors | 0 | 0 | 0 | 0 | - | - |`,
    ``,
    `## Actor Relationship Map`,
    `| Relationship | Weight | Reciprocal | Direction counts | Active rounds | Visibility mix |`,
    `| --- | ---: | --- | --- | --- | --- |`,
    relationshipRows || `| No relationships | 0 | no | - | - | - |`,
    ``,
    `## Round Progression`,
    `| Round | Elapsed | Actions | Active actors | New ties | Strongest actor | Observer summary |`,
    `| ---: | --- | ---: | ---: | ---: | --- | --- |`,
    roundRows || `| - | - | 0 | 0 | 0 | none | No network actions were recorded. |`,
    ``,
    `## Cast`,
    `| Actor | Role | Final intent | Counterparties | Weighted degree |`,
    `| --- | --- | --- | ---: | ---: |`,
    actorRows || `| No actors | - | - | 0 | 0 |`,
    ``,
    `## Run Metadata`,
    `- Stop reason: ${state.stopReason || "not set"}`,
    `- Recorded interactions: ${state.interactions.length}`,
    `- Valid network actions: ${dynamics.summary.validActionCount}`,
    `- Raw evidence: state.json, events.jsonl, graph.timeline.json`,
    state.errors.length ? `- Errors: ${state.errors.join("; ")}` : `- Errors: none`,
  ].filter((section) => section !== "").join("\n")
}

function renderNetworkSummary(dynamics: ReturnType<typeof calculateNetworkDynamics>): string {
  if (dynamics.summary.validActionCount === 0) {
    return "No valid actor-to-actor network actions were recorded."
  }
  const reciprocalPairs = dynamics.summary.highestReciprocityPairs
    .map((relationship) => `${relationship.sourceName} - ${relationship.targetName}`)
    .join(", ")
  return [
    `- Most central actor: ${dynamics.summary.mostCentralActor?.actorName ?? "none"}.`,
    `- Most active dyad: ${dynamics.summary.mostActiveDyad ? `${dynamics.summary.mostActiveDyad.sourceName} - ${dynamics.summary.mostActiveDyad.targetName}` : "none"}.`,
    `- Reciprocal relationship pairs: ${dynamics.summary.reciprocalPairCount}.`,
    `- Highest reciprocity pair: ${reciprocalPairs || "none"}.`,
    `- Network concentration: ${formatPercent(dynamics.summary.networkConcentration)} of weighted actor activity belongs to the top actor.`,
  ].join("\n")
}

function directionCountsText(relationship: NetworkRelationshipMetric): string {
  const directionLabels = {
    [`${relationship.sourceActorId}->${relationship.targetActorId}`]: `${relationship.sourceName} -> ${relationship.targetName}`,
    [`${relationship.targetActorId}->${relationship.sourceActorId}`]: `${relationship.targetName} -> ${relationship.sourceName}`,
  }
  return Object.entries(relationship.directionCounts)
    .filter(([, count]) => count > 0)
    .map(([direction, count]) => `${directionLabels[direction as keyof typeof directionLabels] ?? direction}: ${count}`)
    .join("; ") || "-"
}

function visibilityMixText(mix: Partial<Record<ActionVisibility, number>>): string {
  const text = Object.entries(mix)
    .filter(([, count]) => count > 0)
    .map(([visibility, count]) => `${visibility}: ${count}`)
    .join(", ")
  return markdownCell(text || "-")
}

function roundRange(firstRound: number | undefined, lastRound: number | undefined): string {
  if (firstRound === undefined || lastRound === undefined) {
    return "-"
  }
  return firstRound === lastRound ? `R${firstRound}` : `R${firstRound}-R${lastRound}`
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\s+/g, " ").trim()
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
  const missed = events.filter((event) => event.status === "missed").length
  return `${completed}/${events.length} major events completed; ${partial} partial; ${pending} pending; ${missed} missed.`
}
