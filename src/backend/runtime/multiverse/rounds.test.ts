/**
 * Purpose: Verify server-owned round approvals and countdown behavior without browser involvement.
 * Pattern: Controlled-clock lifecycle test.
 * Usage: bun test src/backend/runtime/multiverse/rounds.test.ts
 * Related: src/backend/runtime/multiverse/rounds.ts
 */
import { expect, test } from "bun:test"
import { ServerRoundProgression } from "./rounds"

test("automatic rounds wait five seconds three times, then advance without timers", async () => {
  const timers: Array<{ callback: () => void; delay: number; canceled: boolean }> = []
  const updates: Array<{ status: string }> = []
  const rounds = new ServerRoundProgression(true, new AbortController().signal, async update => { updates.push(update) }, {
    now: () => 0,
    schedule: (callback, delay) => { const timer = { callback, delay, canceled: false }; timers.push(timer); return () => { timer.canceled = true } },
  })
  for (let round = 1; round <= 3; round++) {
    const next = rounds.wait(round)
    await Promise.resolve()
    expect(timers.at(-1)?.delay).toBe(5000)
    await rounds.setAutomatic(true)
    expect(timers).toHaveLength(round)
    expect(timers.at(-1)?.canceled).toBe(false)
    timers.at(-1)?.callback()
    await next
  }
  await rounds.wait(4)
  expect(timers).toHaveLength(3)
  expect(updates.at(-1)?.status).toBe("running")
  rounds.dispose()
})

test("disabling automatic progression cancels its countdown and requires an exact round approval", async () => {
  let fire = () => {}
  let disposed = false
  const abort = new AbortController()
  const rounds = new ServerRoundProgression(true, abort.signal, async () => {}, {
    now: () => 0, schedule: callback => { fire = callback; return () => { disposed = true } },
  })
  let advanced = false
  const waiting = rounds.wait(2).then(() => { advanced = true })
  await Promise.resolve()
  await rounds.setAutomatic(false)
  expect(disposed).toBe(true)
  fire()
  await Promise.resolve()
  expect(advanced).toBe(false)
  await expect(rounds.continue(1)).rejects.toThrow("waiting round")
  await rounds.continue(2)
  await waiting
  const pending = rounds.wait(3)
  const rejected = pending.then(() => false, () => true)
  abort.abort(new Error("stop"))
  expect(await rejected).toBe(true)
  rounds.dispose()
})
