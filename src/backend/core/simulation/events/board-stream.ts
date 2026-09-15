import type { RunEvent } from "@/shared"

/** Forward output immediately; runtime routes drafts only to interested readers. */
export async function createBoardStream(runId: string, emit: (event: RunEvent) => Promise<void>, id: string, field: string) {
  const streamId = crypto.randomUUID()
  let sequence = 0
  const send = (content: string) => emit({ type: "board.updated", runId, timestamp: new Date().toISOString(),
    update: { kind: "preview", id, field, content, streamId, sequence: sequence++ } })
  await send("")
  return { onDelta: send }
}
