import { isDeepStrictEqual } from "node:util"
import type { RunEvent } from "@/shared"
import { buildActorRounds } from "@/ui/models/actors/actor-conversation"
import { emptyConversationData, updateConversationData } from "@/ui/models/actors/conversation-data"
import { appendMetricData, emptyMetricData } from "@/ui/models/metrics/metric-data"

const count = 4000
const batchSize = 20
const metrics: RunEvent[] = Array.from({ length: count }, (_, index) => ({
  type: "model.metrics", runId: "benchmark", timestamp: String(index),
  metrics: { role: "actor", step: "message", attempt: 1, ttftMs: index % 900, durationMs: 100 + index % 700, inputTokens: 100, reasoningTokens: 10, outputTokens: 40, totalTokens: 150, tokenSource: "provider" },
}))
const conversations: RunEvent[] = Array.from({ length: count }, (_, index) => ({ type: "interaction.recorded", runId: "benchmark", timestamp: String(index), interaction: {
  id: String(index), roundIndex: Math.floor(index / 20), sourceActorId: "a", targetActorIds: ["b"], eventId: "e", visibility: "public", decisionType: "action", actionType: "Speak", content: "A message to b", thought: "Consider b's response", intent: "", expectation: "",
} }))
function median(operation: () => unknown) {
  operation()
  const values = Array.from({ length: 5 }, () => { const start = performance.now(); operation(); return performance.now() - start }).sort((a, b) => a - b)
  return Number(values[2]!.toFixed(2))
}
function fullMetrics() {
  let result = emptyMetricData()
  for (let end = batchSize; end <= count; end += batchSize) result = appendMetricData(emptyMetricData(), metrics.slice(0, end))
  return result
}
function incrementalMetrics() {
  let result = emptyMetricData()
  for (let start = 0; start < count; start += batchSize) result = appendMetricData(result, metrics.slice(start, start + batchSize))
  return result
}
function fullConversation() {
  let result = buildActorRounds([])
  for (let end = batchSize; end <= count; end += batchSize) result = buildActorRounds(conversations.slice(0, end))
  return result
}
function incrementalConversation() {
  let result = emptyConversationData()
  for (let start = 0; start < count; start += batchSize) result = updateConversationData(result, conversations, conversations.slice(start, start + batchSize))
  return result.rounds
}
if (!isDeepStrictEqual(fullMetrics(), incrementalMetrics()) || !isDeepStrictEqual(fullConversation(), incrementalConversation())) throw new Error("Incremental projections differ from full computation")
for (const [name, full, incremental] of [["metrics", fullMetrics, incrementalMetrics], ["conversation", fullConversation, incrementalConversation]] as const) {
  console.log(JSON.stringify({ name, events: count, batchSize, fullMedianMs: median(full), incrementalMedianMs: median(incremental), equal: true }))
}
