import { appendMetricData, emptyMetricData } from "@/ui/models/metrics/metric-data"
import { renderToStaticMarkup } from "react-dom/server"
import type { RunEvent } from "@/shared"
import { LlmMetricsPanelView } from "@/ui/components/metrics/llm-metrics-panel"
import { dictionary } from "@/ui/i18n/dictionary"
import { useRunStore } from "@/ui/stores/run-store"

function metrics(count: number): RunEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    type: "model.metrics", runId: "benchmark", timestamp: new Date(index).toISOString(),
    metrics: { role: "actor", step: "message", attempt: 1, ttftMs: index % 900, durationMs: 100 + index % 700,
      inputTokens: 100, reasoningTokens: 10, outputTokens: 40, totalTokens: 150, tokenSource: "provider" },
  }))
}
function median(operation: () => void): number {
  operation()
  const times = Array.from({ length: 5 }, () => {
    const start = performance.now()
    operation()
    return performance.now() - start
  }).sort((a, b) => a - b)
  return Number(times[2].toFixed(2))
}
for (const count of [1000, 4000]) {
  const events = metrics(count)
  const chartMs = median(() => { renderToStaticMarkup(<LlmMetricsPanelView data={appendMetricData(emptyMetricData(), events)} t={dictionary.en} />) })
  const ingestionMs = median(() => {
    useRunStore.getState().resetLiveState()
    for (let index = 0; index < count; index += 20) useRunStore.getState().pushEvents(events.slice(index, index + 20))
  })
  console.log(JSON.stringify({ events: count, chartRenderMedianMs: chartMs, batchedIngestionMedianMs: ingestionMs }))
}

const { selectCompletedRound, selectTerminalEvent } = await import("@/ui/stores/run/selectors")
useRunStore.getState().resetLiveState()
useRunStore.getState().setSelectedRunId("benchmark")
let liveEventUpdates = 0
let roundControlUpdates = 0
let conversationUpdates = 0
let stageUpdates = 0
const unsubscribe = useRunStore.subscribe((next, previous) => {
  if (next.liveEvents !== previous.liveEvents) liveEventUpdates++
  if (selectCompletedRound(next) !== selectCompletedRound(previous) || selectTerminalEvent(next) !== selectTerminalEvent(previous)) roundControlUpdates++
  if (next.conversationEvents !== previous.conversationEvents) conversationUpdates++
  if (next.stageEvents !== previous.stageEvents) stageUpdates++
})
const stream = metrics(4000)
for (let index = 0; index < stream.length; index += 20) useRunStore.getState().pushEvents(stream.slice(index, index + 20))
unsubscribe()
console.log(JSON.stringify({ metricBatches: 200, liveEventUpdates, roundControlUpdates, conversationUpdates, stageUpdates }))
