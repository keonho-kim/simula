import { expect, spyOn, test } from "bun:test"
import { updateActiveNodes } from "./active-nodes"
import { ACTIVE_NODE_TTL_MS } from "./constants"

test("active highlighting refreshes only on activation and expiry, extending repeated activity", () => {
  let now = 0
  let nextId = 0
  const timers = new Map<number, { callback: () => void; due: number }>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const clock = spyOn(performance, "now").mockImplementation(() => now)
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout(callback: () => void, delay: number) {
      timers.set(++nextId, { callback, due: now + delay })
      return nextId
    },
    clearTimeout(id: number) { timers.delete(id) },
  } })
  try {
    const until = new Map<string, number>()
    const active = { current: new Set<string>() }
    const timer = { current: undefined as number | undefined }
    updateActiveNodes(["actor-a"], until, active, null, timer)
    const initial = active.current
    expect([...initial]).toEqual(["actor-a"])
    now = 500
    updateActiveNodes(["actor-a"], until, active, null, timer)
    expect(active.current).toBe(initial)
    expect(timers.size).toBe(1)
    const pending = timers.get(timer.current!)!
    expect(pending.due).toBe(500 + ACTIVE_NODE_TTL_MS)
    now = pending.due
    pending.callback()
    expect(active.current.size).toBe(0)
    expect(timer.current).toBeUndefined()
    expect(until.size).toBe(0)
  } finally {
    clock.mockRestore()
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow)
    else Reflect.deleteProperty(globalThis, "window")
  }
})
