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

test("parallel actor activity ends independently when each card completes", () => {
  const board = updateScenarioBoard(emptyScenarioBoard(), [start,
    { ...base, type: "board.updated", update: { kind: "actor.started", id: "actor-1" } },
    { ...base, type: "board.updated", update: { kind: "actor.started", id: "actor-2" } },
  ])
  expect(board.activeActorIds).toEqual(["actor-1", "actor-2"])
  const completed = updateScenarioBoard(board, [{ ...base, type: "board.updated", update: {
    kind: "actor", id: "actor-2", card: { name: "B", role: "Role", backgroundHistory: "Background", personality: "Calm", preference: "Agree" },
  } }])
  expect(completed.activeActorIds).toEqual(["actor-1"])
  expect(completed.cards["actor-2"]?.name).toBe("B")
})

test("streamed drafts append once and retries replace rejected output", () => {
  const preview = (streamId: string, sequence: number, content: string): RunEvent => ({ ...base, type: "board.updated", update: {
    kind: "preview", id: "coreSituation", field: "coreSituation", streamId, sequence, content,
  } })
  const first = preview("first", 1, "partial")
  const board = updateScenarioBoard(emptyScenarioBoard(), [start, preview("first", 0, ""), first, first])
  expect(board.drafts.coreSituation?.coreSituation).toBe("partial")
  expect(board.digest.coreSituation).toBeUndefined()
  const retry = updateScenarioBoard(board, [preview("retry", 0, ""), preview("retry", 1, "revised")])
  expect(retry.drafts.coreSituation?.coreSituation).toBe("revised")
  expect(updateScenarioBoard(retry, [digest]).digest.coreSituation).toBe("A concrete situation.")
})
