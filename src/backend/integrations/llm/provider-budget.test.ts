/**
 * Purpose: Verify task output ceilings reach an OpenAI-compatible HTTP endpoint.
 * Pattern: Local transport integration test.
 * Usage: Executed by bun test without external credentials or model calls.
 * Related: src/backend/integrations/llm/invoke.ts, src/backend/integrations/llm/model-factory.ts
 */
import { expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { invokeRoleInputWithMetrics, invokeRoleTextWithMetrics } from "./invoke"
import { createVisionInput } from "./vision-input"

test("per-call output limits override conflicting extra body values on the wire", async () => {
  let received: unknown
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      received = await request.json()
      const chunk = { id: "test", object: "chat.completion.chunk", created: 0, model: "local-model", choices: [
        { index: 0, delta: { role: "assistant", content: "완료" }, finish_reason: "stop" },
      ] }
      return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
        headers: { "content-type": "text/event-stream" },
      })
    },
  })
  const settings = defaultSettings()
  settings.roles.planner = { ...settings.roles.planner, provider: "vllm", model: "local-model", extraBody: { max_tokens: 9000 } }
  settings.providers.vllm = { baseUrl: `http://127.0.0.1:${server.port}/v1`, apiKey: "local-test" }
  try {
    const result = await invokeRoleTextWithMetrics(settings, "planner", "actionCatalog", 1, "단문을 작성하세요.", undefined, { maxOutputTokens: 512 })
    expect(result.text).toBe("완료")
    expect(received).toMatchObject({ max_tokens: 512 })
    expect(settings.roles.planner.extraBody).toEqual({ max_tokens: 9000 })
    const input = createVisionInput("이 자료의 표를 설명하세요.", {
      mimeType: "image/png",
      bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA1cAAAAASUVORK5CYII=", "base64"),
    })
    await invokeRoleInputWithMetrics(settings, "planner", "draft", 1, input, undefined, { maxOutputTokens: 640 })
    expect(received).toMatchObject({ max_tokens: 640, messages: input })
  } finally { await server.stop(true) }
})

test("empty and oversized images fail before provider work", () => {
  expect(() => createVisionInput("Read", { mimeType: "image/png", bytes: new Uint8Array() })).toThrow("8 MiB")
  expect(() => createVisionInput("Read", { mimeType: "image/png", bytes: new Uint8Array(8 * 1024 * 1024 + 1) })).toThrow("8 MiB")
})
