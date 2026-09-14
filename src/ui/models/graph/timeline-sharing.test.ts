import { expect, test } from "bun:test"
import type { GraphTimelineFrame } from "@/shared"
import { shareTimelineFrames } from "./timeline-sharing"

const frame: GraphTimelineFrame = { index: 0, timestamp: "0", nodes: [{ id: "a", label: "Alice", role: "Chair", intent: "Discuss", interactionCount: 1 }, { id: "b", label: "Bob", role: "Actor", intent: "Listen", interactionCount: 0 }], edges: [{ id: "ab", source: "a", target: "b", visibility: "public", visibilityMix: { public: 1 }, weight: 1, roundIndex: 1, latestContent: "Hello" }], messages: ["Hello"], activeNodeIds: ["a"], logRefs: [] }

test("timeline sharing preserves complete replay data and only replaces changed graph records", () => {
  const next = structuredClone(frame)
  next.index = 1
  next.nodes[0]!.interactionCount = 2
  const same = structuredClone(next)
  same.index = 2
  const snapshots = [frame, next, same]
  const compact = shareTimelineFrames(snapshots)
  expect(compact).toEqual(snapshots)
  expect(compact[1]!.nodes[0]).not.toBe(compact[0]!.nodes[0])
  expect(compact[1]!.nodes[1]).toBe(compact[0]!.nodes[1])
  expect(compact[1]!.edges).toBe(compact[0]!.edges)
  expect(compact[2]!.nodes).toBe(compact[1]!.nodes)
  expect(frame.nodes[0]!.interactionCount).toBe(1)
})
