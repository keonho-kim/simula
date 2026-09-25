/**
 * Purpose: Read complete run-log records incrementally with bounded buffering and resumable byte cursors.
 * Pattern: Append-only log reader.
 * Usage: Opened by RunStore for one event-stream connection and closed on disposal.
 * Related: src/shared/run-stream.ts, src/backend/api/runs/event-stream.ts
 */
import { open, type FileHandle } from "node:fs/promises"
import { MAX_RUN_EVENT_BYTES, parseRunCursor, parseRunEventEnvelope, RunStreamCursorError } from "@/shared/run-stream"
import type { RunEvent } from "@/shared/run"

const READ_CHUNK_BYTES = 64 * 1024

export class RunEventLog {
  private buffered = Buffer.alloc(0)
  private position: number
  private consumed: number
  private closed = false

  private constructor(private readonly file: FileHandle, private readonly runId: string, offset: number) {
    this.position = offset
    this.consumed = offset
  }

  static async open(path: string, runId: string, cursor?: string): Promise<RunEventLog> {
    const offset = parseRunCursor(cursor, runId)
    const file = await open(path, "r")
    try {
      if (offset > (await file.stat()).size) throw new RunStreamCursorError("Run event cursor is beyond stored history.")
      if (offset > 0) {
        const boundary = Buffer.alloc(1)
        await file.read(boundary, 0, 1, offset - 1)
        if (boundary[0] !== 10) throw new RunStreamCursorError("Run event cursor is not a record boundary.")
      }
      return new RunEventLog(file, runId, offset)
    } catch (error) { await file.close(); throw error }
  }

  get cursor(): string { return `${this.runId}:${this.consumed}` }

  async next(): Promise<{ cursor: string; body: string; event: RunEvent } | undefined> {
    while (!this.closed) {
      const end = this.buffered.indexOf(10)
      if (end >= 0) {
        if (end > MAX_RUN_EVENT_BYTES) throw new Error("Run event exceeds the stream size limit.")
        const body = this.buffered.subarray(0, end).toString("utf8")
        const event = parseRunEventEnvelope(JSON.parse(body), this.runId)
        this.buffered = this.buffered.subarray(end + 1)
        this.consumed += end + 1
        return { cursor: this.cursor, body, event }
      }
      if (this.buffered.length > MAX_RUN_EVENT_BYTES) throw new Error("Run event exceeds the stream size limit.")
      const chunk = Buffer.alloc(READ_CHUNK_BYTES)
      const { bytesRead } = await this.file.read(chunk, 0, chunk.length, this.position)
      if (this.closed) return undefined
      if (!bytesRead) {
        if ((await this.file.stat()).size < this.position) throw new Error("Run event history was truncated.")
        return undefined
      }
      this.position += bytesRead
      this.buffered = Buffer.concat([this.buffered, chunk.subarray(0, bytesRead)])
    }
    return undefined
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.buffered = Buffer.alloc(0)
    await this.file.close()
  }
}
