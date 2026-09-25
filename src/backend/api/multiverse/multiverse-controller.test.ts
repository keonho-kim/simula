/**
 * Purpose: Verify batch request bounds, idempotency, and world-control scope at the HTTP boundary.
 * Pattern: API contract test.
 * Usage: bun test src/backend/api/multiverse/multiverse-controller.test.ts
 * Related: src/backend/api/multiverse/multiverse-controller.ts, src/backend/runtime/multiverse/test-fixtures.ts
 */
import { expect, test } from "bun:test"
import { batchFixture } from "@/backend/runtime/multiverse/test-fixtures"
import { routeMultiverse } from "./multiverse-controller"

test("API creates one batch for duplicate requests and rejects invalid counts or foreign world controls", async () => {
  const f = await batchFixture()
  const id = crypto.randomUUID()
  const post = (worldCount: number) => new Request("http://localhost/api/multiverse", { method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": id },
    body: JSON.stringify({ scenarioId: f.source.id, worldCount, controls: { maxRound: 1, actionsPerType: 1 } }) })
  const call = (request: Request) => routeMultiverse(f.jobs, request, new URL(request.url))
  try {
    expect((await call(post(51))).status).toBe(400)
    expect((await call(post(0))).status).toBe(400)
    const [first, second] = await Promise.all([call(post(5)), call(post(5))])
    expect(first.status).toBe(202)
    expect((await first.json()).batch.worlds).toEqual((await second.json()).batch.worlds)
    expect((await call(post(3))).status).toBe(409)
    const foreign = new Request(`http://localhost/api/multiverse/${id}/worlds/${crypto.randomUUID()}/cancel`, { method: "POST" })
    expect((await call(foreign)).status).toBe(409)
    await f.jobs.start(id)
    const get = await call(new Request(`http://localhost/api/multiverse/${id}`))
    expect((await get.json()).batch.status).toBe("completed")
  } finally { await f.jobs.cancel(id).catch(() => {}); await f.jobs.start(id).catch(() => {}); await f.close() }
})
