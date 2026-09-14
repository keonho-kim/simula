import type forceAtlas2 from "graphology-layout-forceatlas2"

export function forceAtlasOptions(order: number): Parameters<typeof forceAtlas2.assign>[1] {
  return {
    iterations: order > 300 ? 18 : order > 100 ? 45 : 100,
    getEdgeWeight: "weight",
    settings: {
      adjustSizes: true,
      barnesHutOptimize: order > 80,
      edgeWeightInfluence: 0.45,
      gravity: order > 300 ? 1.05 : order > 100 ? 0.75 : 0.55,
      scalingRatio: order > 300 ? 36 : order > 100 ? 22 : 16,
      slowDown: order > 300 ? 5 : 2.5,
    },
  }
}
