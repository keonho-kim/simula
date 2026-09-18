import { calculateNetworkDynamics, type SimulationState } from "@/shared"
import { compactText } from "@/backend/core/prompts/prompt"

/** Bound each context packet; retain every round and interaction in bounded groups. */
export function prepareReportEvidence(state: SimulationState) {
  const rounds = new Map<number, typeof state.interactions>()
  for (const interaction of state.interactions) {
    const rows = rounds.get(interaction.roundIndex) ?? []
    rows.push(interaction)
    rounds.set(interaction.roundIndex, rows)
  }
  for (const round of state.roundDigests) if (!rounds.has(round.roundIndex)) rounds.set(round.roundIndex, [])
  for (const round of state.roundReports) if (!rounds.has(round.roundIndex)) rounds.set(round.roundIndex, [])
  const reports = new Map(state.roundReports.map((report) => [report.roundIndex, report.roundSummary]))
  const digests = new Map(state.roundDigests.map((digest) => [digest.roundIndex, digest.preRound.content]))
  const context = JSON.stringify({
    scenario: compactText(state.scenario.text, 2400),
    plan: state.plan?.scenarioDigest
      ? Object.fromEntries(
          Object.entries(state.plan.scenarioDigest).map(([key, value]) => [key, compactText(value, 500)])
        )
      : undefined,
    network: calculateNetworkDynamics(state).summary,
    omittedActors: Math.max(0, state.actors.length - 12),
    actors: state.actors
      .slice(0, 12)
      .map((actor) => ({
        id: actor.id,
        name: actor.name,
        role: compactText(actor.role, 80),
        preference: compactText(actor.preference, 120)
      })),
    omittedEvents: Math.max(0, (state.plan?.majorEvents.length ?? 0) - 12),
    events: state.plan?.majorEvents
      .slice(0, 12)
      .map((event) => ({ id: event.id, title: event.title, status: event.status })),
    stopReason: state.stopReason
  })
  const packets = [...rounds]
    .sort(([a], [b]) => a - b)
    .flatMap(([round, interactions]) => {
      const count = Math.max(1, Math.ceil(interactions.length / 8))
      return Array.from({ length: count }, (_, part) => {
        const items = interactions.slice(part * 8, (part + 1) * 8)
        const id = count === 1 ? `round-${round}` : `round-${round}-part-${part + 1}`
        const actorIds = new Set(items.flatMap((item) => [item.sourceActorId, ...item.targetActorIds]))
        return {
          id,
          evidenceIds: [id, ...items.map((item) => item.id)],
          text: JSON.stringify({
            id,
            round,
            part: part + 1,
            parts: count,
            preRound: compactText(digests.get(round), 1000),
            summary: compactText(reports.get(round), 1600),
            interactionCount: interactions.length,
            participants: state.actors
              .filter((actor) => actorIds.has(actor.id))
              .map((actor) => ({ id: actor.id, name: actor.name, role: compactText(actor.role, 80) })),
            note: "Long text fields are shortened; other interaction groups are analyzed separately.",
            interactions: items.map((item) => ({
              id: item.id,
              source: item.sourceActorId,
              targets: item.targetActorIds,
              action: item.actionType,
              content: compactText(item.content, 350),
              intent: compactText(item.intent, 200)
            }))
          })
        }
      })
    })
  return { context, packets }
}
