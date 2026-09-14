import { isDeepStrictEqual } from "node:util"
import type { GraphTimelineFrame } from "@/shared"
import { appendMetricHistory, chartSamples, emptyMetricHistory, type MetricPoint } from "@/ui/models/metrics/sample-history"
import { buildLineGeometry } from "@/ui/models/metrics/line-path"
import { shareTimelineFrames } from "@/ui/models/graph/timeline-sharing"

function median(operation: () => unknown) {
  operation()
  const values = Array.from({ length: 5 }, () => { const start = performance.now(); operation(); return performance.now() - start }).sort((a, b) => a - b)
  return Number(values[2]!.toFixed(2))
}
const points = Array.from({ length: 20000 }, (_, index) => ({ timestamp: String(index), value: index % 997 }))
const history = appendMetricHistory(emptyMetricHistory(), points)
function fullPath() {
  const max = Math.max(...points.map((point) => point.value))
  const coordinates = points.map((point, index) => ({ x: 3 + index / (points.length - 1) * 94, y: 39 - point.value / max * 36 }))
  return coordinates.slice(1).reduce((path, point, index) => {
    const previous = coordinates[index]!
    const control = (previous.x + point.x) / 2
    return `${path} C ${control.toFixed(2)} ${previous.y.toFixed(2)}, ${control.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, `M ${coordinates[0]!.x.toFixed(2)} ${coordinates[0]!.y.toFixed(2)}`)
}
console.log(JSON.stringify({ workload: "chart", samples: points.length, displayedPoints: chartSamples(history).length,
  fullPathChars: fullPath().length, boundedPathChars: buildLineGeometry(history).path.length,
  fullMedianMs: median(fullPath), boundedMedianMs: median(() => buildLineGeometry(history)) }))
console.log(JSON.stringify({ workload: "append-snapshots", samples: points.length, batchSize: 20,
  flatMedianMs: median(() => { let snapshot: MetricPoint[] = []; for (let start = 0; start < points.length; start += 20) snapshot = [...snapshot, ...points.slice(start, start + 20)]; return snapshot }),
  chunkedMedianMs: median(() => { let snapshot = emptyMetricHistory(); for (let start = 0; start < points.length; start += 20) snapshot = appendMetricHistory(snapshot, points.slice(start, start + 20)); return snapshot }),
}))
const frames: GraphTimelineFrame[] = Array.from({ length: 1000 }, (_, index) => ({ index, timestamp: String(index),
  nodes: Array.from({ length: 50 }, (_, node) => ({ id: String(node), label: `Actor ${node}`, role: "Actor", intent: "Discuss", interactionCount: node === 0 ? index : 0 })),
  edges: Array.from({ length: 100 }, (_, edge) => ({ id: String(edge), source: String(edge % 50), target: String((edge + 1) % 50), visibility: "public", weight: edge === 0 ? index : 1, roundIndex: 1, latestContent: "Hello" })),
  activeNodeIds: ["0"], messages: ["Hello"], logRefs: [],
}))
const shared = shareTimelineFrames(frames)
if (!isDeepStrictEqual(frames, shared)) throw new Error("Timeline sharing changed replay data")
const records = (frames: GraphTimelineFrame[]) => new Set(frames.flatMap((frame) => [...frame.nodes, ...frame.edges])).size
console.log(JSON.stringify({ workload: "timeline", frames: frames.length, originalGraphRecords: records(frames), sharedGraphRecords: records(shared), equal: true }))
