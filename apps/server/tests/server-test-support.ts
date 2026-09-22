/**
 * Purpose: Provide run polling, SSE continuation, and provider setup for server API tests.
 * Pattern: Test support module.
 * Usage: Imported by apps/server/tests/server.test.ts.
 * Related: src/backend/api/event-stream.ts, src/backend/core/settings/constants.ts
 */
import { MODEL_ROLES } from "@/backend/core/settings/constants"
import type { LLMSettings, ModelProvider } from "@/shared"

export async function continueRoundsFromEventStream(
  baseUrl: string,
  runId: string,
  response: Response
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const result = await reader.read()
    if (result.done) return
    buffer += decoder.decode(result.value, { stream: true })
    let frameEnd = buffer.indexOf("\n\n")
    while (frameEnd >= 0) {
      const frame = buffer.slice(0, frameEnd)
      buffer = buffer.slice(frameEnd + 2)
      await continueAfterCompletedRound(baseUrl, runId, frame)
      frameEnd = buffer.indexOf("\n\n")
    }
  }
}

export async function pollRun(
  baseUrl: string,
  runId: string,
  status: "completed" | "failed"
): Promise<{ status: string; error?: string }> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const data = (await fetch(`${baseUrl}/api/runs/${runId}`).then((response) => response.json())) as {
      run: { status: string; error?: string }
    }
    if (data.run.status === status) return data.run
    await Bun.sleep(100)
  }
  throw new Error(`Run did not reach ${status}.`)
}

export function setProviderKey(
  settings: LLMSettings,
  apiKey: string,
  provider: ModelProvider = "openai"
): void {
  settings.providers[provider].apiKey = apiKey
  for (const role of MODEL_ROLES) {
    settings.roles[role].provider = provider
  }
}

async function continueAfterCompletedRound(
  baseUrl: string,
  runId: string,
  frame: string
): Promise<void> {
  const eventType = frame.split("\n").find((line) => line.startsWith("event: "))?.slice("event: ".length)
  if (eventType !== "round.completed") return
  const dataLine = frame.split("\n").find((line) => line.startsWith("data: "))
  if (!dataLine) return
  const event = JSON.parse(dataLine.slice("data: ".length)) as { roundIndex?: number }
  if (!Number.isInteger(event.roundIndex)) return
  await fetch(`${baseUrl}/api/runs/${runId}/continue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundIndex: event.roundIndex }),
  })
}
