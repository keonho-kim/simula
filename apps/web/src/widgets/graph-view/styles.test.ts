import { describe, expect, test } from "bun:test"
import type { GraphEdgeView } from "@simula/shared"

const webGlRenderingContext = {
  BOOL: 0,
  BYTE: 1,
  UNSIGNED_BYTE: 2,
  SHORT: 3,
  UNSIGNED_SHORT: 4,
  INT: 5,
  UNSIGNED_INT: 6,
  FLOAT: 7,
  TRIANGLES: 8,
  LINES: 9,
  POINTS: 10,
}

Object.defineProperty(globalThis, "WebGLRenderingContext", {
  configurable: true,
  value: webGlRenderingContext,
})

Object.defineProperty(globalThis, "WebGL2RenderingContext", {
  configurable: true,
  value: webGlRenderingContext,
})

const { edgeAlpha, edgeColor, edgeSize, forceAtlasOptions, graphIntensityColor, nodeSize } = await import("./styles")

describe("graph visual styles", () => {
  test("scales nodes by interaction count and degree", () => {
    const quiet = nodeSize(0, 0)
    const connected = nodeSize(2, 0)
    const active = nodeSize(2, 9)

    expect(connected).toBeGreaterThan(quiet)
    expect(active - connected).toBeGreaterThan(7)
  })

  test("scales edges with visible weight contrast", () => {
    const weak = edgeSize(edge(1))
    const medium = edgeSize(edge(4))
    const strong = edgeSize(edge(16))

    expect(weak).toBeGreaterThanOrEqual(4.7)
    expect(medium - weak).toBeGreaterThan(2)
    expect(strong - medium).toBeGreaterThan(4)
  })

  test("keeps edges visible across interaction intensities", () => {
    expect(edgeAlpha(0)).toBeGreaterThanOrEqual(0.54)
    expect(edgeAlpha(1)).toBeGreaterThanOrEqual(0.82)
    expect(edgeAlpha(1)).toBeGreaterThan(edgeAlpha(0))
    expect(edgeAlpha(4)).toBeGreaterThan(edgeAlpha(1))
    expect(edgeAlpha(8)).toBeGreaterThan(edgeAlpha(4))
    expect(edgeAlpha(12)).toBeGreaterThan(edgeAlpha(8))
  })

  test("uses node-size-aware force atlas spacing", () => {
    const options = forceAtlasOptions(12)

    expect(options.iterations).toBe(100)
    expect(options.getEdgeWeight).toBe("weight")
    expect(options.settings).toMatchObject({
      adjustSizes: true,
      barnesHutOptimize: false,
      edgeWeightInfluence: 0.45,
      gravity: 0.55,
      scalingRatio: 16,
      slowDown: 2.5,
    })
  })

  test("keeps large graph force atlas settings bounded", () => {
    const options = forceAtlasOptions(320)

    expect(options.iterations).toBe(18)
    expect(options.settings).toMatchObject({
      adjustSizes: true,
      barnesHutOptimize: true,
      gravity: 1.05,
      scalingRatio: 36,
      slowDown: 5,
    })
  })

  test("maps interaction intensity to distinct colors", () => {
    expect(graphIntensityColor(0)).toBe("#d7dee8")
    expect(graphIntensityColor(1)).not.toBe(graphIntensityColor(4))
    expect(graphIntensityColor(4)).not.toBe(graphIntensityColor(8))
    expect(graphIntensityColor(8)).not.toBe(graphIntensityColor(12))
    expect(edgeColor(1)).not.toBe(edgeColor(12))
    expect(edgeColor(1)).toContain("37, 99, 235")
  })
})

function edge(weight: number): GraphEdgeView {
  return {
    id: `edge-${weight}`,
    source: "a",
    target: "b",
    visibility: "public",
    weight,
    roundIndex: 1,
    latestContent: "",
  }
}
