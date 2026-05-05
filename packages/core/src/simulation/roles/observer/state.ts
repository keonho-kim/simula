import type { ObserverTrace, RoundReport, SimulationState } from "@simula/shared"

export function applyObserverRound(state: SimulationState): SimulationState {
  const roundIndex = state.observerRoundIndex ?? state.roundDigests.length
  const trace = state.roleTraces.find((item) => item.role === "observer")
  if (!trace || trace.role !== "observer") {
    return state
  }

  return {
    ...state,
    roundReports: upsertRoundReport(state.roundReports, roundReportFromTrace(roundIndex, trace)),
  }
}

function roundReportFromTrace(roundIndex: number, trace: ObserverTrace): RoundReport {
  return {
    roundIndex,
    title: `Round ${roundIndex}`,
    roundSummary: trace.roundSummary,
  }
}

function upsertRoundReport(reports: RoundReport[], report: RoundReport): RoundReport[] {
  return [...reports.filter((item) => item.roundIndex !== report.roundIndex), report].sort(
    (a, b) => a.roundIndex - b.roundIndex
  )
}
