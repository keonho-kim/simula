import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { createBoardStream } from "./board-stream"

test("batches output chunks and flushes remaining text with ordered sequence numbers", async () => {
  const events: RunEvent[] = []
  const stream = await createBoardStream("run", async event => { events.push(event) }, "coreSituation", "coreSituation")
  await stream.onDelta("Hello ")
  await stream.onDelta("world")
  await stream.flush()
  await stream.flush()
  const updates = events.flatMap(event => event.type === "board.updated" && event.update.kind === "preview" ? [event.update] : [])
  expect(updates.map(update => update.content).join("")).toBe("Hello world")
  expect(updates.map(update => update.sequence)).toEqual(updates.map((_, index) => index))
  expect(updates[0]?.sequence).toBe(0)
  expect(updates[0]?.content).toBe("")
})
