/**
 * Purpose: Verify bounded model admission, fair owner ordering, and cancellation cleanup.
 * Pattern: Runtime contract test.
 * Usage: bun test src/backend/runtime/model-admission.test.ts
 * Related: src/backend/runtime/model-admission.ts
 */
import { expect, test } from "bun:test"
import { ModelAdmission } from "./model-admission"

test("raising the configured allowance admits pending calls without restart", async () => {
  const admission = new ModelAdmission({ concurrency: 1 })
  const release = await admission.acquire("pool", "one")
  const queued = admission.acquire("pool", "two")
  expect(admission.snapshot().waiting).toBe(1)
  admission.setConcurrency(2)
  const second = await queued
  expect(admission.snapshot().active).toBe(2)
  second(); release()
})

test("50 independent world calls can hold permits concurrently when configured", async () => {
  const admission = new ModelAdmission({ concurrency: 50 })
  const permits = await Promise.all(Array.from({ length: 50 }, (_, index) => admission.acquire("endpoint/model", `world-${index}`)))
  expect(admission.snapshot()).toEqual({ active: 50, waiting: 0, pools: 1 })
  for (const release of permits) release()
  expect(admission.snapshot()).toEqual({ active: 0, waiting: 0, pools: 0 })
})

test("nested actor fan-out cannot exceed a pool limit and waiting owners rotate", async () => {
  const admission = new ModelAdmission({ concurrency: 1 })
  const first = await admission.acquire("model", "world-a")
  const order: string[] = []
  const pending = ["world-a", "world-a", "world-b", "world-c", "world-b"].map(owner =>
    admission.acquire("model", owner).then(release => { order.push(owner); return release }))
  expect(admission.snapshot()).toEqual({ active: 1, waiting: 5, pools: 1 })
  first()
  const b1 = await pending[2]!
  expect(order).toEqual(["world-b"])
  b1()
  const c1 = await pending[3]!
  c1()
  const a1 = await pending[0]!
  a1()
  const b2 = await pending[4]!
  b2()
  const a2 = await pending[1]!
  a2()
  a2()
  expect(order).toEqual(["world-b", "world-c", "world-a", "world-b", "world-a"])
  expect(admission.snapshot().pools).toBe(0)
})

test("canceling a queued world removes it without blocking other pools or owners", async () => {
  const admission = new ModelAdmission({ concurrency: 1, maxQueued: 2 })
  const first = await admission.acquire("model-a", "world-a")
  const controller = new AbortController()
  const canceled = admission.acquire("model-a", "world-b", controller.signal)
  const failure = canceled.then(() => "unexpected admission", error => error.message)
  const next = admission.acquire("model-a", "world-c")
  await expect(admission.acquire("model-a", "world-d")).rejects.toThrow("queue is full")
  const other = await admission.acquire("model-b", "world-e")
  controller.abort(new Error("stop world-b"))
  expect(await failure).toBe("stop world-b")
  expect(admission.snapshot()).toEqual({ active: 2, waiting: 1, pools: 2 })
  first()
  ;(await next)()
  other()
  await expect(admission.acquire("model-a", "world-b", controller.signal)).rejects.toThrow("stop world-b")
  expect(admission.snapshot().pools).toBe(0)
})

test("expired queue entries release their listeners and capacity", async () => {
  const admission = new ModelAdmission({ concurrency: 1, waitTimeoutMs: 1 })
  const release = await admission.acquire("model", "first")
  await expect(admission.acquire("model", "expired")).rejects.toThrow("admission timed out")
  expect(admission.snapshot().waiting).toBe(0)
  release()
  expect(admission.snapshot().pools).toBe(0)
})
