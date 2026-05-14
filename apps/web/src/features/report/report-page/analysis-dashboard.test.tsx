import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ActorState, Interaction, RunEvent, SimulationState } from "@simula/shared"
import { dictionary } from "@/lib/i18n/dictionary"
import { buildReportAnalysisViewModel } from "../report-analysis-view-model"
import { ReportAnalysisDashboard } from "./analysis-dashboard"

describe("ReportAnalysisDashboard", () => {
  test("renders compact simulation summary before LLM analytics", () => {
    const model = buildReportAnalysisViewModel(createState([
      interaction("i1", 1, "ceo", ["cto"], "private", "briefing"),
      interaction("i2", 2, "cto", ["ceo"], "private", "reply"),
    ]))

    const html = renderToStaticMarkup(
      <TooltipProvider>
        <ReportAnalysisDashboard events={[
          metricEvent("2026-01-01T00:00:00.000Z", 120, 1000, 300, 100, 200),
          metricEvent("2026-01-01T00:00:01.000Z", 180, 1500, 600, 500, 700),
        ]} model={model} t={dictionary.en} />
      </TooltipProvider>
    )

    expect(html.indexOf("Token range")).toBeLessThan(html.indexOf("Report briefing"))
    expect(html).toContain("Report briefing")
    expect(html).toContain("Simulation delivered")
    expect(html).toContain("Model intelligence measured")
    expect(html).toContain("2 / 2")
    expect(html).toContain("Dynamics signal map")
    expect(html).toContain("Directed density")
    expect(html).toContain("Avg target spread")
    expect(html).toContain("Planned-event completion")
    expect(html).toContain("Token range")
    expect(html).toContain("2 / 2 samples")
    expect(html).toContain("100 - 500")
    expect(html).toContain("200 - 700")
    expect(html).toContain("Avg TTFT")
    expect(html).toContain("Avg Duration")
    expect(html).toContain("Avg Token/sec")
    expect(html).not.toContain("Relationship Structure")
    expect(html).not.toContain("Relationship heatmap")
    expect(html).not.toContain("Round Evolution")
    expect(html).not.toContain("Participant alignment")
  })

  test("renders an empty state without a run", () => {
    const html = renderToStaticMarkup(<ReportAnalysisDashboard events={[]} model={undefined} t={dictionary.en} />)

    expect(html).toContain("No run selected")
    expect(html).toContain("Select or complete a run")
  })
})

function createState(interactions: Interaction[]): SimulationState {
  return {
    runId: "run-1",
    scenario: {
      sourceName: "scenario.md",
      text: "Scenario",
      controls: {
        numCast: 2,
        allowAdditionalCast: false,
        actionsPerType: 1,
        maxRound: 2,
        fastMode: true,
      },
    },
    plan: {
      interpretation: "Interpretation",
      backgroundStory: "Background",
      actionCatalog: [],
      majorEvents: [{
        id: "event-1",
        title: "Board decision",
        summary: "The board decision must complete.",
        status: "completed",
        participantIds: ["ceo", "cto"],
      }],
    },
    actors: [
      actor("ceo", "CEO"),
      actor("cto", "CTO"),
    ],
    interactions,
    roundDigests: [],
    roundReports: [],
    roleTraces: [],
    worldSummary: "Summary",
    reportMarkdown: "",
    stopReason: "simulation_done",
    errors: [],
  }
}

function metricEvent(
  timestamp: string,
  ttftMs: number,
  durationMs: number,
  totalTokens: number,
  inputTokens: number,
  outputTokens: number
): Extract<RunEvent, { type: "model.metrics" }> {
  return {
    type: "model.metrics",
    runId: "run-1",
    timestamp,
    metrics: {
      role: "planner",
      step: "coreSituation",
      attempt: 1,
      ttftMs,
      durationMs,
      inputTokens,
      reasoningTokens: 0,
      outputTokens,
      totalTokens,
      tokenSource: "provider",
    },
  }
}

function actor(id: string, name: string): ActorState {
  return {
    id,
    name,
    role: `${name} role`,
    backgroundHistory: "",
    personality: "",
    preference: "",
    privateGoal: "",
    intent: "",
    actions: [],
    context: { visible: [] },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}

function interaction(
  id: string,
  roundIndex: number,
  sourceActorId: string,
  targetActorIds: string[],
  visibility: Interaction["visibility"],
  actionType: string
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType,
    content: `${sourceActorId} to ${targetActorIds.join(", ")}`,
    eventId: "event-1",
    visibility,
    decisionType: "action",
    intent: "Act.",
    expectation: "Change the network.",
  }
}
