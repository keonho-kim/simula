/**
 * Purpose: Verify shared history cards distinguish solitary action records from spoken dialogue.
 * Pattern: Server-rendered presentation contract test.
 * Usage: bun test src/ui/components/actors/history/message-card.test.tsx
 * Related: src/ui/components/actors/history/message-card.tsx, src/ui/models/actors/actor-conversation.ts
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { ActorMessageCard } from "./message-card"

for (const locale of ["ko", "en"] as const) test(`history labels solitary actions separately from speech (${locale})`, () => {
  const t = dictionary[locale]
  const props = { id: "entry", actorId: "actor-1", actorName: "민수", timestamp: "", role: "담당자", targets: "",
    thought: "확인이 필요하다.", action: "자료 정리", content: "확인할 항목을 메모한다.", decisionType: "action" as const, t, onActorSelect: () => {} }
  const solitary = renderToStaticMarkup(<ActorMessageCard {...props} visibility="solitary" />)
  expect(solitary).toContain(t.actorRailSolitaryAction)
  expect(solitary).not.toContain(`aria-label="${t.actorRailSpeech}"`)
  const speech = renderToStaticMarkup(<ActorMessageCard {...props} visibility="private" targets="지수" />)
  expect(speech).toContain(`aria-label="${t.actorRailSpeech}"`)
  expect(speech).not.toContain(t.actorRailSolitaryAction)
})
