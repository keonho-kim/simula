/**
 * Purpose: Adapt text StoryBuilder requests to cancellable model execution and NDJSON delivery.
 * Pattern: HTTP streaming adapter.
 * Usage: Called by the story-builder draft routes.
 * Related: src/backend/core/story-builder/index.ts, src/backend/integrations/llm/execution-context.ts
 */
import type { LLMSettings, StoryBuilderDraftRequest, StoryBuilderStreamEvent } from "@/shared"
import { draftScenario, streamDraftScenario } from "@/backend/core/story-builder"
import { runWithModelExecution, type ModelCallAdmission, type ModelExecution } from "@/backend/integrations/llm/execution-context"
import { readSettings } from "@/backend/storage/settings-store"
import { json } from "../responses"

export async function handleStoryBuilder(request: Request, streaming: boolean, admission: ModelCallAdmission,
  getSettings: () => Promise<LLMSettings> = readSettings): Promise<Response> {
  try {
    const payload = await request.json() as StoryBuilderDraftRequest
    const settings = await getSettings()
    const controller = new AbortController()
    const execution: ModelExecution = { owner: `draft-${crypto.randomUUID()}`, admission,
      signal: AbortSignal.any([request.signal, controller.signal]) }
    if (!streaming) return json(await runWithModelExecution(execution, () => draftScenario(payload, settings)))
    return streamStoryBuilderResponse(payload, settings, execution, controller)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "StoryBuilder failed." }, { status: 400 })
  }
}

function streamStoryBuilderResponse(payload: StoryBuilderDraftRequest, settings: LLMSettings,
  execution: ModelExecution, cancellation: AbortController): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runWithModelExecution(execution, async () => {
          for await (const event of streamDraftScenario(payload, settings)) {
            if (execution.signal.aborted) break
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
          }
        })
      } catch (error) {
        if (!execution.signal.aborted) {
          const event: StoryBuilderStreamEvent = { type: "error", error: error instanceof Error ? error.message : "StoryBuilder failed." }
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }
      } finally {
        if (!cancellation.signal.aborted) controller.close()
      }
    },
    cancel() { cancellation.abort(new Error("StoryBuilder stream closed.")) },
  })
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } })
}
