import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { createBoardStream } from "./board-stream"

test("forwards each output chunk immediately with ordered sequence numbers", async () => {
  const events: RunEvent[] = []
  const stream = await createBoardStream("run", async event => { events.push(event) }, "coreSituation", "coreSituation")
  await stream.onDelta("Hello ")
  expect(events).toHaveLength(2)
  await stream.onDelta("world")
  expect(events).toHaveLength(3)
  const updates = events.flatMap(event => event.type === "board.updated" && event.update.kind === "preview" ? [event.update] : [])
  expect(updates.map(update => update.content).join("")).toBe("Hello world")
  expect(updates.map(update => update.sequence)).toEqual(updates.map((_, index) => index))
  expect(updates[0]?.sequence).toBe(0)
  expect(updates[0]?.content).toBe("")
})
