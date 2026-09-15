import type { RunEvent } from "@/shared"

/** Batch visible output deltas; retries replace the previous unvalidated draft. */
export async function createBoardStream(runId: string, emit: (event: RunEvent) => Promise<void>, id: string, field: string) {
  let pending = ""
  let lastFlush = Date.now()
  const streamId = crypto.randomUUID()
  let sequence = 0
  const send = (content: string) => emit({ type: "board.updated", runId, timestamp: new Date().toISOString(),
    update: { kind: "preview", id, field, content, streamId, sequence: sequence++ } })
  await send("")
  const flush = async () => {
    if (!pending) return
    const content = pending
    pending = ""
    lastFlush = Date.now()
    await send(content)
  }
  return {
    onDelta: async (text: string) => {
      pending += text
      if (Date.now() - lastFlush >= 250) await flush()
    },
    flush,
  }
}
