import { parseJsonMarkdown } from "@langchain/core/output_parsers"
import type { RunEvent } from "@/shared"
import { createBoardStream } from "@/backend/core/simulation/events/board-stream"

const fields = ["label", "intentHint", "expectedOutcome"] as const

/** Parse partial JSON with LangChain; publish only named string fields as drafts. */
export async function createActionBoardStream(runId: string, emit: (event: RunEvent) => Promise<void>) {
  const streams = new Map<string, Awaited<ReturnType<typeof createBoardStream>>>()
  const previous = new Map<string, string>()
  for (const field of fields) streams.set(field, await createBoardStream(runId, emit, "actions-pending", field))
  let buffer = ""
  return {
    async onDelta(delta: string) {
      buffer += delta
      const parsed: unknown = parseJsonMarkdown(buffer)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return
      const partial = parsed as Record<string, unknown>
      for (const field of fields) {
        const value = partial[field]
        if (typeof value !== "string") continue
        let old = previous.get(field) ?? ""
        if (value === old) continue
        // A completed escape can replace a provisional decoded value.
        if (!value.startsWith(old)) {
          streams.set(field, await createBoardStream(runId, emit, "actions-pending", field))
          old = ""
        }
        await streams.get(field)!.onDelta(value.slice(old.length))
        previous.set(field, value)
      }
    },
  }
}
