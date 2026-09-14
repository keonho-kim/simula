export interface MetricPoint { timestamp: string; value: number }
export interface IndexedMetricPoint extends MetricPoint { index: number }
interface MetricChunk {
  points: IndexedMetricPoint[]
  min: IndexedMetricPoint
  max: IndexedMetricPoint
}
export interface MetricHistory { length: number; max: number; chunks: MetricChunk[] }
export const METRIC_CHUNK_SIZE = 128

export function emptyMetricHistory(): MetricHistory { return { length: 0, max: 0, chunks: [] } }

// Completed chunks are immutable; only the tail is copied on append.
export function appendMetricHistory(previous: MetricHistory, added: MetricPoint[]): MetricHistory {
  if (!added.length) return previous
  const chunks = [...previous.chunks]
  const tail = chunks.at(-1)
  let pending = tail && tail.points.length < METRIC_CHUNK_SIZE ? [...chunks.pop()!.points] : []
  let max = previous.max
  const seal = () => {
    let min = pending[0]!
    let peak = min
    for (const point of pending) {
      if (point.value < min.value) min = point
      if (point.value > peak.value) peak = point
    }
    chunks.push({ points: pending, min, max: peak })
    pending = []
  }
  for (let index = 0; index < added.length; index++) {
    const point = { ...added[index]!, index: previous.length + index }
    pending.push(point)
    if (Number.isFinite(point.value)) max = Math.max(max, point.value)
    if (pending.length === METRIC_CHUNK_SIZE) seal()
  }
  if (pending.length) seal()
  return { length: previous.length + added.length, max, chunks }
}

export function latestMetricPoint(history: MetricHistory): IndexedMetricPoint | undefined {
  return history.chunks.at(-1)?.points.at(-1)
}

export const CHART_BUCKETS = 128
// Preserve endpoints and each display bucket's extrema. Raw samples remain available in chunks.
export function chartSamples(history: MetricHistory): IndexedMetricPoint[] {
  if (history.length <= CHART_BUCKETS * 2 + 2) return history.chunks.flatMap((chunk) => chunk.points)
  const samples = new Map<number, IndexedMetricPoint>()
  const add = (point: IndexedMetricPoint) => samples.set(point.index, point)
  add(history.chunks[0]!.points[0]!)
  const chunksPerBucket = Math.ceil(history.chunks.length / CHART_BUCKETS)
  for (let start = 0; start < history.chunks.length; start += chunksPerBucket) {
    let min = history.chunks[start]!.min
    let max = history.chunks[start]!.max
    for (let index = start + 1; index < Math.min(start + chunksPerBucket, history.chunks.length); index++) {
      const chunk = history.chunks[index]!
      if (chunk.min.value < min.value) min = chunk.min
      if (chunk.max.value > max.value) max = chunk.max
    }
    add(min)
    add(max)
  }
  add(latestMetricPoint(history)!)
  return [...samples.values()].sort((a, b) => a.index - b.index)
}
