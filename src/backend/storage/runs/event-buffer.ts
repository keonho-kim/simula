/**
 * Purpose: Retain only unconfirmed event frames for one process-scoped SSE stream.
 * Pattern: Append-only queue with stable logical cursors.
 * Usage: Owned by RunStore while an active browser session owns the run.
 * Related: src/backend/storage/runs/run-store.ts, src/backend/api/runs/event-stream.ts
 */
import type { RunEvent } from "@/shared/run"
import { MAX_RUN_EVENT_BYTES, parseRunCursor, RunStreamCursorError } from "@/shared/run-stream"

interface BufferedEvent { readonly end: number; readonly body: string; readonly event: RunEvent }

export class RunEventBuffer {
  private readonly events: BufferedEvent[] = []
  private confirmedOffset = 0
  private endOffset = 0

  constructor(private readonly runId: string) {}

  get retainedCount(): number { return this.events.length }
  get latestOffset(): number { return this.endOffset }

  append(event: RunEvent): number {
    if (event.runId !== this.runId) throw new Error("Run event scope does not match its buffer.")
    const body = JSON.stringify(event)
    const bytes = Buffer.byteLength(body)
    if (bytes > MAX_RUN_EVENT_BYTES) throw new Error("Run event exceeds the stream size limit.")
    this.endOffset += bytes + 1
    this.events.push({ end: this.endOffset, body, event })
    return this.endOffset
  }

  open(cursor?: string): BufferedRunEventLog {
    const offset = parseRunCursor(cursor, this.runId)
    if (offset < this.confirmedOffset) throw new RunStreamCursorError("Run event cursor precedes confirmed browser history.")
    if (offset > this.endOffset || offset !== this.confirmedOffset && !this.events.some(entry => entry.end === offset)) {
      throw new RunStreamCursorError("Run event cursor is not a stored record boundary.")
    }
    return new BufferedRunEventLog(this, offset)
  }

  prune(offset: number): boolean {
    if (!Number.isSafeInteger(offset) || offset < this.confirmedOffset || offset > this.endOffset) return false
    if (offset === this.confirmedOffset) return true
    const index = this.events.findIndex(entry => entry.end === offset)
    if (index < 0) return false
    this.events.splice(0, index + 1)
    this.confirmedOffset = offset
    return true
  }

  next(after: number): BufferedEvent | undefined {
    if (after < this.confirmedOffset) throw new RunStreamCursorError("Run event cursor precedes confirmed browser history.")
    let low = 0, high = this.events.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (this.events[middle]!.end <= after) low = middle + 1
      else high = middle
    }
    return this.events[low]
  }
}

export class BufferedRunEventLog {
  private closed = false

  constructor(private readonly buffer: RunEventBuffer, private position: number) {}

  async next(): Promise<{ cursor: string; body: string; event: RunEvent } | undefined> {
    if (this.closed) return undefined
    const entry = this.buffer.next(this.position)
    if (!entry) return undefined
    this.position = entry.end
    return { cursor: `${entry.event.runId}:${entry.end}`, body: entry.body, event: entry.event }
  }

  async close(): Promise<void> { this.closed = true }
}
