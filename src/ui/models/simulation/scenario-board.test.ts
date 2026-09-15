import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { boardProgress, emptyScenarioBoard, updateScenarioBoard } from "./scenario-board"
import { useRunStore } from "@/ui/stores/run-store"

const base = { runId: "board", timestamp: "2026-09-15T00:00:00Z" }
const start: RunEvent = { ...base, type: "run.started" }
const digest: RunEvent = { ...base, type: "board.updated", update: { kind: "digest", key: "coreSituation", content: "A concrete situation." } }

test("accepted artifacts are idempotent, progress counts work, and a new run resets the board", () => {
  const events: RunEvent[] = [start,
    { ...base, type: "board.updated", update: { kind: "config", actorCount: 1, actionCount: 4 } }, digest,
    { ...base, type: "board.updated", update: { kind: "actions", actions: [{ id: "PUB01", label: "Ask", visibility: "public", intentHint: "Ask why", expectedOutcome: "Learn" }] } },
  ]
  const board = updateScenarioBoard(emptyScenarioBoard(), events)
  expect(boardProgress(board)).toBe(16)
  expect(updateScenarioBoard(board, events.slice(1)).actions).toHaveLength(1)
  const ready = updateScenarioBoard(board, [{ ...base, type: "event.injected", event: { id: "e", sourceEventId: "e", title: "Event", summary: "", roundIndex: 1 } }])
  expect(ready.ready).toBe(true)
  expect(updateScenarioBoard(ready, [{ ...base, type: "node.started", nodeId: "coordinator", label: "Coordinator" }]).ready).toBe(true)
  expect(updateScenarioBoard(ready, [{ ...base, type: "run.failed", error: "Failed" }]).terminal).toBe(true)
  expect(updateScenarioBoard(ready, [start]).digest).toEqual({})
})

test("board artifacts survive telemetry retention and restore from persisted events", () => {
  const store = useRunStore.getState()
  store.resetLiveState()
  store.pushEvents([start, digest])
  store.pushEvents(Array.from({ length: 400 }, (_, i) => ({ ...base, type: "log", level: "info", message: String(i) })))
  expect(useRunStore.getState().liveEvents).toHaveLength(300)
  expect(useRunStore.getState().scenarioBoard.digest.coreSituation).toBe("A concrete situation.")
  expect(updateScenarioBoard(emptyScenarioBoard(), [start, digest])).toEqual(useRunStore.getState().scenarioBoard)
  store.resetLiveState()
})
