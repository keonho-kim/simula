import { expect, spyOn, test } from "bun:test"
import Graph from "graphology"
import { EDGE_ANIMATION_MS } from "./constants"
import type { ActorGraph, EdgeAnimationState, LayoutAnimationState } from "./types"
import type { GraphTimelineFrame } from "@/shared"

// Sigma reads WebGL enum values on import; these tests exercise graph data, not WebGL rendering.
const webGl = { BOOL: 0, BYTE: 1, UNSIGNED_BYTE: 2, SHORT: 3, UNSIGNED_SHORT: 4, INT: 5, UNSIGNED_INT: 6, FLOAT: 7, TRIANGLES: 8, LINES: 9, POINTS: 10 }
Object.defineProperty(globalThis, "WebGLRenderingContext", { configurable: true, value: webGl })
Object.defineProperty(globalThis, "WebGL2RenderingContext", { configurable: true, value: webGl })
const { animateNodePositions, cancelAnimation, cancelEdgeAnimation } = await import("./animation")
const { writeGraphFrame } = await import("./frame-writer")

test("layout and edge transitions reach their targets and cancellation removes scheduled work", () => {
  let now = 0
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const clock = spyOn(performance, "now").mockImplementation(() => now)
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    requestAnimationFrame(callback: FrameRequestCallback) { callbacks.set(++nextId, callback); return nextId },
    cancelAnimationFrame(id: number) { callbacks.delete(id) },
  } })
  const advance = (time: number) => {
    now = time
    const pending = [...callbacks.values()]
    callbacks.clear()
    for (const callback of pending) callback(now)
  }
  try {
    const graph: ActorGraph = new Graph({ type: "directed", multi: true })
    const layout: LayoutAnimationState = {}
    const edges: EdgeAnimationState = { items: new Map() }
    const positions = new Map()
    const frameIndex = { current: undefined as number | undefined }
    const round = { current: undefined as number | undefined }
    const frame: GraphTimelineFrame = {
      index: 0, timestamp: "2026-09-15T00:00:00Z", activeNodeIds: [], messages: [], logRefs: [],
      nodes: ["a", "b"].map((id) => ({ id, label: id, role: "actor", intent: "", interactionCount: 1 })),
      edges: [{ id: "a-b", source: "a", target: "b", visibility: "public", weight: 1, roundIndex: 1, latestContent: "hello" }],
    }
    writeGraphFrame(graph, frame, positions, frameIndex, round, layout, edges)
    advance(EDGE_ANIMATION_MS)
    expect(edges.items.size).toBe(0)
    let unchangedWrites = 0
    const onWrite = () => { unchangedWrites++ }
    graph.on("nodeAttributesUpdated", onWrite)
    graph.on("edgeAttributesUpdated", onWrite)
    expect(writeGraphFrame(graph, { ...structuredClone(frame), index: 1 }, positions, frameIndex, round, layout, edges)).toBe(false)
    expect(unchangedWrites).toBe(0)
    graph.off("nodeAttributesUpdated", onWrite)
    graph.off("edgeAttributesUpdated", onWrite)
    const previousSize = graph.getEdgeAttribute("a-b", "size")
    writeGraphFrame(graph, { ...frame, index: 1, edges: [{ ...frame.edges[0]!, weight: 3 }] }, positions, frameIndex, round, layout, edges)
    expect(edges.items.has("a-b")).toBe(true)
    advance(EDGE_ANIMATION_MS * 2)
    expect(graph.getEdgeAttribute("a-b", "size")).toBeGreaterThan(previousSize)
    const startX = graph.getNodeAttribute("a", "x")
    const startY = graph.getNodeAttribute("a", "y")
    animateNodePositions(graph, positions, layout, new Map([["a", { x: 10, y: 20 }]]), 500)
    advance(now + 250)
    expect(positions.get("a")!.x).toBeCloseTo(startX + (10 - startX) * 0.875, 8)
    expect(positions.get("a")!.y).toBeCloseTo(startY + (20 - startY) * 0.875, 8)
    expect(layout.frameId).toBeDefined()
    advance(now + 250)
    expect(positions.get("a")).toEqual({ x: 10, y: 20 })
    expect(layout.frameId).toBeUndefined()
    animateNodePositions(graph, positions, layout, new Map([["a", { x: 0, y: 0 }]]), 500)
    cancelAnimation(layout)
    cancelEdgeAnimation(edges)
    expect(callbacks.size).toBe(0)
    expect(positions.get("a")).toEqual({ x: 10, y: 20 })
  } finally {
    clock.mockRestore()
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow)
    else Reflect.deleteProperty(globalThis, "window")
  }
})
