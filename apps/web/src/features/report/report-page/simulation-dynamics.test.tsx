import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ActorState, Interaction, SimulationState } from "@simula/shared"
import { dictionary } from "@/lib/i18n/dictionary"
import { buildReportAnalysisViewModel } from "../report-analysis-view-model"
import { ReportSimulationDynamics } from "./simulation-dynamics"

describe("ReportSimulationDynamics", () => {
  test("renders behavior and coordinator quality signals", () => {
    const model = buildReportAnalysisViewModel(createState([
      interaction("i1", 1, "ceo", ["cto"], "private", "briefing"),
      interaction("i2", 2, "cto", ["ceo"], "semi-public", "reply"),
    ]))

    const html = renderToStaticMarkup(
      <TooltipProvider>
        <ReportSimulationDynamics model={model} t={dictionary.en} />
      </TooltipProvider>
    )

    expect(html).toContain("Behavior Diversity")
    expect(html).toContain("Coordinator alignment")
    expect(html).toContain("Directed density")
    expect(html).toContain("Avg target spread")
    expect(html).toContain("Event completion")
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
