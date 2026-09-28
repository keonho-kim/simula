/**
 * Purpose: Verify actor detail cards separate activity, recipients, and localized visibility.
 * Pattern: Server-rendered presentation contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/components/actors/actor-panel.tsx, src/ui/models/actors/actor-history.ts
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { ActorHistoryCard } from "./actor-panel"
import { buildActorHistory } from "@/ui/models/actors/actor-history"
import type { Interaction, RunEvent } from "@/shared"

const action: Interaction = { id: "one", sourceActorId: "actor-1", targetActorIds: [], roundIndex: 1, actionType: "자료 정리",
  content: "확인할 점을 메모한다.", visibility: "solitary", decisionType: "action", eventId: "event", intent: "확인", expectation: "정리" }

test("solitary and held records have no invented recipient or internal labels", () => {
  for (const decisionType of ["action", "no_action"] as const) {
    const items = buildActorHistory([], [{ ...action, decisionType }], new Map(), dictionary.ko)
    const html = renderToStaticMarkup(<ActorHistoryCard item={items[0]!} t={dictionary.ko} />)
    expect(html).toContain(decisionType === "action" ? "혼자 한 행동" : "행동 보류")
    expect(html).toContain("공유 안 함")
    for (const internal of ["SOLO", "HELD", "본인", "solitary", "no_action"]) expect(html).not.toContain(internal)
  }
})

test("correlated speech merges with stored interaction even without adjacent events", () => {
  const interaction = { ...action, targetActorIds: ["actor-2"], content: "민수: 확인해 주세요.", visibility: "private" as const }
  const event: RunEvent = { type: "actor.message", actorId: "actor-1", actorName: "민수", runId: "run", timestamp: "now",
    content: "확인해 주세요.", interactionId: interaction.id, roundIndex: 1 }
  const rows = buildActorHistory([event], [interaction], new Map([["actor-1", "민수"], ["actor-2", "지수"]]), dictionary.ko)
  const own = rows.filter(item => item.id.startsWith("actor-1:"))
  expect(own).toHaveLength(1)
  expect(own[0]?.hasSpeech).toBe(true)
  const html = renderToStaticMarkup(<ActorHistoryCard item={own[0]!} t={dictionary.ko} />)
  expect(html).toContain("지수")
  expect(html).toContain("상대에게만 공개")
  expect(html).toContain("대화")
  expect(html).not.toContain("본인")
})
