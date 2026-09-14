import { expect, test } from "bun:test"
import { appendMetricHistory, chartSamples, emptyMetricHistory, METRIC_CHUNK_SIZE, CHART_BUCKETS } from "./sample-history"
import { buildLineGeometry } from "./line-path"

test("metric appends share completed chunks and retain every original sample", () => {
  const points = Array.from({ length: METRIC_CHUNK_SIZE * 3 }, (_, index) => ({ timestamp: String(index), value: index }))
  const first = appendMetricHistory(emptyMetricHistory(), points.slice(0, 140))
  const next = appendMetricHistory(first, points.slice(140))
  expect(next.chunks[0]).toBe(first.chunks[0])
  expect(first.chunks[1]!.points).toHaveLength(12)
  expect(next.chunks.flatMap((chunk) => chunk.points.map((point) => ({ timestamp: point.timestamp, value: point.value })))).toEqual(points)
  expect(next).toEqual(appendMetricHistory(emptyMetricHistory(), points))
})

test("bounded SVG preserves full time span and peaks without discarding original data", () => {
  const points = Array.from({ length: 20000 }, (_, index) => ({ timestamp: String(index), value: index === 9999 ? 10000 : index === 10000 ? -5 : index % 50 }))
  const history = appendMetricHistory(emptyMetricHistory(), points)
  const samples = chartSamples(history)
  expect(samples.length).toBeLessThanOrEqual(CHART_BUCKETS * 2 + 2)
  expect(samples[0]!.index).toBe(0)
  expect(samples.at(-1)!.index).toBe(19999)
  expect(samples.some((point) => point.index === 9999)).toBe(true)
  expect(samples.some((point) => point.index === 10000)).toBe(true)
  expect(history.length).toBe(20000)
  expect((buildLineGeometry(history).path.match(/ C /g) ?? []).length).toBeLessThanOrEqual(CHART_BUCKETS * 2 + 1)
})
