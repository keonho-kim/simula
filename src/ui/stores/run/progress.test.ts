/**
 * Purpose: Verify run control facts survive bounded display history, stale replay and scope changes.
 * Pattern: Store behavior contract tests.
 * Usage: bun test src/ui/stores/run/progress.test.ts
 * Related: src/ui/stores/run-store.ts, src/ui/stores/run/selectors.ts
 */
import { beforeEach, expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { useRunStore } from "../run-store"
import { selectCompletedRound, selectTerminalEvent } from "./selectors"

const runId = "progress-run"
const timestamp = "2026-01-01T00:00:00.000Z"
const round = (roundIndex: number): RunEvent => ({ type: "round.completed", runId, timestamp, roundIndex })
const logs = (start: number): RunEvent[] => Array.from({ length: 350 }, (_, i) => ({ type: "log", runId,
  timestamp, level: "info", message: `log-${start + i}` }))

beforeEach(() => { const store = useRunStore.getState(); store.setSelectedRunId(runId); store.resetLiveState() })

test("old history cannot erase or regress a newer round after display-window eviction", () => {
  const store = useRunStore.getState()
  const history: RunEvent[] = [{ type: "run.started", runId, timestamp }, ...logs(0), round(1)]
  store.pushEvents(history)
  store.pushEvent(round(5))
  store.pushEvents(history)
  expect(selectCompletedRound(useRunStore.getState())).toBe(5)
  store.pushEvents(logs(500))
  expect(useRunStore.getState().liveEvents).toHaveLength(300)
  expect(selectCompletedRound(useRunStore.getState())).toBe(5)
})

test("terminal control state survives additional telemetry and replayed start/round events", () => {
  const store = useRunStore.getState()
  store.pushEvent({ type: "run.completed", runId, timestamp, stopReason: "simulation_done" })
  store.pushEvents([...logs(0), { type: "run.started", runId, timestamp }, round(1)])
  expect(selectTerminalEvent(useRunStore.getState())?.type).toBe("run.completed")
  expect(selectCompletedRound(useRunStore.getState())).toBeUndefined()
})

test("a final round that requires no approval does not open another continuation", () => {
  useRunStore.getState().pushEvent({ type: "round.completed", runId, timestamp, roundIndex: 4, awaitsContinuation: false })
  expect(selectCompletedRound(useRunStore.getState())).toBeUndefined()
})

test("changing run scope excludes old progress and late events from the previous run", () => {
  const store = useRunStore.getState()
  store.pushEvent(round(5))
  store.setSelectedRunId("another-run")
  expect(selectCompletedRound(useRunStore.getState())).toBeUndefined()
  store.pushEvent({ type: "round.completed", runId: "another-run", timestamp, roundIndex: 1 })
  store.pushEvent({ type: "run.failed", runId, timestamp, error: "Old run" })
  expect(selectCompletedRound(useRunStore.getState())).toBe(1)
  expect(selectTerminalEvent(useRunStore.getState())).toBeUndefined()
  store.resetLiveState()
  expect(selectCompletedRound(useRunStore.getState())).toBeUndefined()
})
