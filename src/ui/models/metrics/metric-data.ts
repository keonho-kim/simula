import { appendMetricHistory, emptyMetricHistory, type MetricHistory, type MetricPoint } from "./sample-history"
import type { RunEvent } from "@/shared"
export interface MetricData {
  ttft: MetricHistory
  duration: MetricHistory
  tokensPerSecond: MetricHistory
  totalTokens: number
  inputTokens: number
  reasoningTokens: number
  outputTokens: number
}

export function emptyMetricData(): MetricData {
  return { ttft: emptyMetricHistory(), duration: emptyMetricHistory(), tokensPerSecond: emptyMetricHistory(), totalTokens: 0, inputTokens: 0, reasoningTokens: 0, outputTokens: 0 }
}

// Only accepted new events enter this reducer; duplicate detection belongs to the run store.
export function appendMetricData(previous: MetricData, events: RunEvent[]): MetricData {
  const metrics = events.filter((event): event is Extract<RunEvent, { type: "model.metrics" }> => event.type === "model.metrics")
  if (!metrics.length) return previous
  const next = { ...previous }
  const ttft: MetricPoint[] = []
  const duration: MetricPoint[] = []
  const tokensPerSecond: MetricPoint[] = []
  for (const { timestamp, metrics: value } of metrics) {
    next.totalTokens += value.totalTokens
    next.inputTokens += value.inputTokens
    next.reasoningTokens += value.reasoningTokens
    next.outputTokens += value.outputTokens
    ttft.push({ timestamp, value: value.ttftMs })
    duration.push({ timestamp, value: value.durationMs })
    tokensPerSecond.push({ timestamp, value: value.durationMs > 0 ? value.totalTokens / value.durationMs * 1000 : 0 })
  }
  return { ...next, ttft: appendMetricHistory(previous.ttft, ttft), duration: appendMetricHistory(previous.duration, duration), tokensPerSecond: appendMetricHistory(previous.tokensPerSecond, tokensPerSecond) }
}
