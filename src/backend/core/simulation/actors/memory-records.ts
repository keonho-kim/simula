/**
 * Purpose: Accept code-assembled, evidence-linked changes to an actor's retained memory.
 * Pattern: Boundary parser and pure reducer.
 * Usage: Used by actor memory ingestion and decision-context projection.
 * Related: src/shared/actor-memory.ts, src/backend/core/simulation/actors/retain-memory.ts
 */
import { z } from "zod"
import type { ActorMemoryLedger, ActorMemoryRecord } from "@/shared/actor-memory"
import type { ActorVisibleContextEntry } from "@/shared"

export const MEMORY_QUOTE_CHARS = 240
export const MEMORY_CHANGES_PER_ENTRY = 3
const MAX_ACTIVE_RECORDS = 24
const MAX_RETAINED_RECORDS = 256
const quote = z.string().trim().min(4).max(MEMORY_QUOTE_CHARS)
const updateSchema = z.object({
  additions: z.array(z.object({ kind: z.enum(["commitment", "decision", "authority", "constraint", "unresolved"]), quote }).strict()).max(MEMORY_CHANGES_PER_ENTRY),
  closures: z.array(z.object({ recordId: z.string().min(1).max(200), quote }).strict()).max(MEMORY_CHANGES_PER_ENTRY),
}).strict()
type MemoryUpdate = z.infer<typeof updateSchema>

export function activeMemoryRecords(ledger: ActorMemoryLedger | undefined): ActorMemoryRecord[] {
  return ledger?.records.filter(record => record.status === "active") ?? []
}

export function parseMemoryUpdate(value: unknown, entry: ActorVisibleContextEntry, records: readonly ActorMemoryRecord[]): MemoryUpdate {
  const result = updateSchema.parse(value)
  const additions = new Set<string>()
  const closures = new Set<string>()
  for (const change of [...result.additions, ...result.closures]) {
    if (!entry.content.includes(change.quote)) throw new Error("Every quote must occur exactly in the current visible entry.")
  }
  for (const change of result.additions) {
    if (additions.has(change.quote)) throw new Error("Duplicate additions are not allowed.")
    additions.add(change.quote)
  }
  for (const change of result.closures) {
    const record = records.find(record => record.id === change.recordId && record.status === "active")
    if (!record || record.sourceEntryId === entry.id || record.roundIndex > entry.roundIndex) {
      throw new Error("Close only an existing active record using later visible evidence.")
    }
    if (closures.has(change.recordId)) throw new Error("Duplicate closures are not allowed.")
    closures.add(change.recordId)
  }
  return result
}

export function applyMemoryUpdate(previous: ActorMemoryLedger | undefined, entry: ActorVisibleContextEntry, update: MemoryUpdate, actorId: string): ActorMemoryLedger {
  if (previous?.lastEntryId === entry.id) return previous
  const records: ActorMemoryRecord[] = (previous?.records ?? []).map(record => {
    const closure = update.closures.find(change => change.recordId === record.id)
    return closure ? { ...record, status: "closed", closure: { entryId: entry.id, quote: closure.quote, roundIndex: entry.roundIndex } } : record
  })
  for (const addition of update.additions) {
    if (records.some(record => record.status === "active" && record.kind === addition.kind && record.quote === addition.quote
      && record.sourceActorId === entry.sourceActorId)) continue
    records.push({ ...addition, id: `${actorId}:memory:${records.length + 1}`, sourceEntryId: entry.id,
      sourceActorId: entry.sourceActorId, sourceActorName: entry.sourceActorName, roundIndex: entry.roundIndex, status: "active" })
  }
  if (records.length > MAX_RETAINED_RECORDS || records.filter(record => record.status === "active").length > MAX_ACTIVE_RECORDS) {
    throw new Error("Actor memory capacity reached; stop this run and review unresolved records instead of discarding them.")
  }
  return { processedCount: (previous?.processedCount ?? 0) + 1, lastEntryId: entry.id, records }
}
