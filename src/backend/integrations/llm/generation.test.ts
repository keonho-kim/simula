/**
 * Purpose: Verify compact LM Studio calls use the existing bounded streaming path without wasting tokens on reasoning.
 * Pattern: Controlled provider contract test.
 * Usage: bun test src/backend/integrations/llm/generation.test.ts
 * Related: src/backend/integrations/llm/generation.ts, src/backend/integrations/llm/invoke.ts
 */
import { expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import type { GenerationCall } from "@/backend/core/generation/tasks"
import { createGenerationInvocation } from "./generation"

test("LM Studio compact tasks disable reasoning without changing detailed tasks or explicit role settings", async () => {
  const requests: Array<Record<string, unknown>> = []
  const server = Bun.serve({ port: 0, async fetch(request) {
    requests.push(await request.json() as Record<string, unknown>)
    const chunk = { id: "test", object: "chat.completion.chunk", created: 0, model: "local", choices: [
      { index: 0, delta: { role: "assistant", content: '{"entry":"' }, finish_reason: null },
    ] }
    const final = { ...chunk, choices: [{ index: 0, delta: { content: 'Keep facts fixed."}' }, finish_reason: "stop" }] }
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(final)}\n\ndata: [DONE]\n\n`,
      { headers: { "content-type": "text/event-stream" } })
  } })
  const settings = defaultSettings()
  settings.roles.storyBuilder = { ...settings.roles.storyBuilder, provider: "lmstudio", model: "local" }
  settings.providers.lmstudio = { baseUrl: `http://127.0.0.1:${server.port}/v1`, apiKey: "local-test" }
  const controller = new AbortController()
  const deltas: string[] = []
  const call = (kind: GenerationCall["kind"]): GenerationCall => ({ id: kind, kind, attempt: 1,
    prompt: "Return one JSON entry.", maxOutputTokens: 384, evidenceIds: [], signal: controller.signal,
    onDelta: async text => { deltas.push(text) }, onAdmission: async () => {} })
  try {
    const compact = await createGenerationInvocation(settings, controller.signal).invoke(call("rules"))
    expect(compact.text).toBe('{"entry":"Keep facts fixed."}')
    expect(deltas.join("")).toBe(compact.text)
    expect(requests[0]).toMatchObject({ max_tokens: 384, reasoning_effort: "none" })
    await createGenerationInvocation(settings, controller.signal).invoke(call("report-detail"))
    expect(requests[1]).not.toHaveProperty("reasoning_effort")
    settings.roles.storyBuilder.reasoningEffort = "low"
    await createGenerationInvocation(settings, controller.signal).invoke(call("rules"))
    expect(requests[2]).toMatchObject({ reasoning_effort: "low" })
    delete settings.roles.storyBuilder.reasoningEffort
    settings.roles.storyBuilder.extraBody = { reasoning_effort: "high" }
    await createGenerationInvocation(settings, controller.signal).invoke(call("rules"))
    expect(requests[3]).toMatchObject({ reasoning_effort: "high" })
  } finally { await server.stop(true) }
})
