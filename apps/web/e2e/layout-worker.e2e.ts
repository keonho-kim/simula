import { expect, test } from "@playwright/test"

test("large graph layout leaves browser animation frames available", async ({ page }, testInfo) => {
  await page.goto("/")
  const measurement = await page.evaluate(async (workerModule) => {
    const { default: LayoutWorker } = await import(workerModule)
    const worker: Worker = new LayoutWorker()
    const count = 1000
    const input = {
      nodes: Array.from({ length: count }, (_, index) => ({ id: String(index), x: Math.cos(index) * 100, y: Math.sin(index) * 100, size: 8 })),
      edges: Array.from({ length: count }, (_, index) => ({ id: String(index), source: String(index), target: String((index + 1) % count), weight: 1 })),
    }
    let animationFrames = 0
    let frameId: number
    const tick = () => { animationFrames++; frameId = requestAnimationFrame(tick) }
    frameId = requestAnimationFrame(tick)
    const start = performance.now()
    try {
      const positions = await new Promise<Array<[string, { x: number; y: number }]>>((resolve, reject) => {
        worker.onmessage = (event) => resolve(event.data)
        worker.onerror = (event) => reject(new Error(event.message))
        worker.postMessage(input)
      })
      return { nodes: positions.length, animationFrames, elapsedMs: Math.round(performance.now() - start), finite: positions.every(([, point]) => Number.isFinite(point.x) && Number.isFinite(point.y)) }
    } finally {
      cancelAnimationFrame(frameId)
      worker.terminate()
    }
  }, "/src/ui/components/graph/layout/layout.worker.ts?worker")
  expect(measurement.nodes).toBe(1000)
  expect(measurement.finite).toBe(true)
  expect(measurement.animationFrames).toBeGreaterThan(0)
  await testInfo.attach("worker-responsiveness", { body: JSON.stringify(measurement), contentType: "application/json" })
  console.log("Worker responsiveness:", JSON.stringify(measurement))
})
