import { expect, test } from "bun:test"
import { BoardPreviews } from "./board-previews"
import type { RunEvent } from "@/shared"

const preview = (id: string, sequence: number, content: string): RunEvent => ({ type: "board.updated", runId: "r", timestamp: "now",
  update: { kind: "preview", id, field: "role", streamId: "s", sequence, content } })

test("late readers receive a snapshot followed by only their selected item's live deltas", () => {
  const hub = new BoardPreviews()
  hub.publish(preview("a", 0, ""))
  hub.publish(preview("a", 1, "Hello"))
  const received: RunEvent[] = []
  const close = hub.subscribe("r", "a", event => received.push(event))
  expect(received[0]).toMatchObject({ update: { content: "Hello", snapshot: true, sequence: 1 } })
  hub.publish(preview("b", 0, ""))
  hub.publish(preview("a", 2, " world"))
  expect(received).toHaveLength(2)
  expect(received[1]).toMatchObject({ update: { content: " world", sequence: 2 } })
  close()
  hub.publish(preview("a", 3, "!"))
  expect(received).toHaveLength(2)
  hub.publish({ type: "run.canceled", runId: "r", timestamp: "now" })
  hub.subscribe("r", "a", event => received.push(event))()
  expect(received).toHaveLength(2)
})
