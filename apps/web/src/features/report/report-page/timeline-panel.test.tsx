import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/lib/i18n/dictionary"
import type { ReportTimelineRound } from "../report-view-model"
import { TimelinePanel } from "./timeline-panel"

describe("TimelinePanel", () => {
  test("renders interaction intent and expectation as markdown", () => {
    const rounds: ReportTimelineRound[] = [{
      roundIndex: 1,
      elapsedTime: "",
      preRound: "",
      title: "Round 1",
      roundSummary: "",
      interactions: [{
        id: "interaction-1",
        roundIndex: 1,
        sourceActorId: "a",
        sourceName: "A",
        targetActorIds: ["b"],
        targetNames: ["B"],
        actionType: "briefing",
        visibility: "private",
        decisionType: "action",
        content: "A speaks to B.",
        intent: "**Hold position**",
        expectation: "**B responds**",
      }],
    }]

    const html = renderToStaticMarkup(
      <TimelinePanel
        actorFilter="all"
        actorOptions={[]}
        rounds={rounds}
        t={dictionary.en}
        onActorFilterChange={() => undefined}
        onActorSelect={() => undefined}
      />
    )

    expect(html).toContain("<strong>Hold position</strong>")
    expect(html).toContain("<strong>B responds</strong>")
  })
})
