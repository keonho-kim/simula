import type { RoundReport, SimulationState } from "@simula/shared"

export function applyObserverRound(state: SimulationState): SimulationState {
  const roundIndex = state.observerRoundIndex ?? state.roundDigests.length
  const trace = state.roleTraces.find((item) => item.role === "observer")
  if (!trace) {
    return state
  }

  return {
    ...state,
    roundDigests: state.roundDigests.map((digest) =>
      digest.roundIndex === roundIndex
        ? {
            ...digest,
            afterRound: {
              content: trace.action,
            },
          }
        : digest
    ),
    roundReports: upsertRoundReport(state.roundReports, {
      roundIndex,
      title: `Round ${roundIndex}`,
      summary: trace.action,
      keyInteractions: state.interactions
        .filter((interaction) => interaction.roundIndex === roundIndex)
        .map((interaction) => interaction.content),
      actorImpacts: [trace.target],
      unresolvedQuestions: [trace.intent],
    }),
  }
}

function upsertRoundReport(reports: RoundReport[], report: RoundReport): RoundReport[] {
  return [...reports.filter((item) => item.roundIndex !== report.roundIndex), report].sort(
    (a, b) => a.roundIndex - b.roundIndex
  )
}
