import { expect, test } from "bun:test"
import Graph from "graphology"
import { createLayoutWorker } from "./worker-client"
import { calculateLayout } from "./calculate"
import type { ActorGraph } from "../types"

test("layout calculation returns finite positions without mutating its snapshot", () => {
  const input = { nodes: [{ id: "a", x: 0, y: 0, size: 8 }, { id: "b", x: 1, y: 1, size: 8 }], edges: [{ id: "ab", source: "a", target: "b", weight: 1 }] }
  const previous = structuredClone(input)
  const result = calculateLayout(input)
  expect(result.map(([id]) => id)).toEqual(["a", "b"])
  expect(result.every(([, point]) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  expect(input).toEqual(previous)
})

test("new layout requests terminate old workers and ignore late results and errors", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "Worker")
  const workers: TestWorker[] = []
  class TestWorker {
    onmessage?: (event: { data: unknown }) => void
    onerror?: (event: { message: string }) => void
    terminated = false
    constructor() { workers.push(this) }
    terminate() { this.terminated = true }
    postMessage() {}
  }
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: TestWorker })
  try {
    let results = 0
    let errors = 0
    const client = createLayoutWorker(() => results++, () => errors++)
    const graph: ActorGraph = new Graph({ type: "directed", multi: true })
    client.request(graph)
    client.request(graph)
    expect(workers[0]!.terminated).toBe(true)
    workers[0]!.onmessage?.({ data: [] })
    workers[0]!.onerror?.({ message: "obsolete" })
    expect(results).toBe(0)
    expect(errors).toBe(0)
    workers[1]!.onmessage?.({ data: [] })
    expect(results).toBe(1)
    expect(workers[1]!.terminated).toBe(true)
    client.request(graph)
    client.cancel()
    workers[2]!.onmessage?.({ data: [] })
    expect(results).toBe(1)
    client.request(graph)
    workers[3]!.onerror?.({ message: "failed" })
    expect(errors).toBe(1)
  } finally {
    if (original) Object.defineProperty(globalThis, "Worker", original)
    else Reflect.deleteProperty(globalThis, "Worker")
  }
})
