/**
 * Purpose: Read bounded JSON request bodies without trusting content-length alone.
 * Pattern: HTTP input boundary.
 * Usage: Shared by scenario-build and world-preparation controllers.
 * Related: src/backend/api/scenario-builder/scenario-builder-controller.ts, src/backend/api/worlds/world-controller.ts
 */
export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maximumBytes) throw new RangeError("Request too large")
  const reader = request.body?.getReader()
  if (!reader) throw new SyntaxError("Empty input")
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.byteLength
      if (length > maximumBytes) { await reader.cancel(); throw new RangeError("Request too large") }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}
