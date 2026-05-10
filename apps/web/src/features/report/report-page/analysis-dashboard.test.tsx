import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { ActorState, Interaction, SimulationState } from "@simula/shared"
import { dictionary } from "@/lib/i18n/dictionary"
import { buildReportAnalysisViewModel } from "../report-analysis-view-model"
import { ReportAnalysisDashboard } from "./analysis-dashboard"

describe("ReportAnalysisDashboard", () => {
  test("renders graph, behavior, and coordinator sections", () => {
    const model = buildReportAnalysisViewModel(createState([
      interaction("i1", 1, "ceo", ["cto"], "private", "briefing"),
      interaction("i2", 2, "cto", ["ceo"], "private", "reply"),
    ]))

    const html = renderToStaticMarkup(<ReportAnalysisDashboard model={model} t={dictionary.en} />)

    expect(html).toContain("Relationship Structure")
    expect(html).toContain("Behavior Diversity")
    expect(html).toContain("Coordinator alignment")
    expect(html).toContain("Relationship heatmap")
    expect(html).toContain("Round Evolution")
  })

  test("renders an empty state without a run", () => {
    const html = renderToStaticMarkup(<ReportAnalysisDashboard model={undefined} t={dictionary.en} />)

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
