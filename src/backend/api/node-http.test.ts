/**
 * Purpose: Verify the Next host preserves API bodies and streamed responses.
 * Pattern: HTTP boundary contract test.
 * Usage: bun test src/backend/api/node-http.test.ts
 * Related: src/backend/api/node-http.ts, server.ts
 */
import { expect, test } from "bun:test"
import { createServer } from "node:http"
import { once } from "node:events"
import { toWebRequest, writeWebResponse } from "./node-http"

test("Node HTTP bridge preserves request bodies, response headers, and stream chunks", async () => {
  const server = createServer((incoming, outgoing) => {
    void (async () => {
      const request = toWebRequest(incoming, outgoing)
      const body = await request.text()
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(body))
          controller.enqueue(encoder.encode("-tail"))
          controller.close()
        },
      })
      await writeWebResponse(outgoing, new Response(stream, { headers: { "X-Simula-Test": "streamed" } }))
    })()
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  try {
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Missing test address.")
    const response = await fetch(`http://127.0.0.1:${address.port}/api/echo`, { method: "POST", body: "hello" })
    expect(response.headers.get("X-Simula-Test")).toBe("streamed")
    expect(await response.text()).toBe("hello-tail")
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
