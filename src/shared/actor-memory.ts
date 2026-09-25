/**
 * Purpose: Define source-linked actor memory retained independently of prose summaries.
 * Pattern: Serializable domain contracts.
 * Usage: Stored inside actor context and projected into actor decision requests.
 * Related: src/shared/simulation.ts, src/backend/core/simulation/actors/memory-records.ts
 */
export type ActorMemoryKind = "commitment" | "decision" | "authority" | "constraint" | "unresolved"

export interface ActorMemoryRecord {
  id: string
  kind: ActorMemoryKind
  quote: string
  sourceEntryId: string
  sourceActorId?: string
  sourceActorName?: string
  roundIndex: number
  status: "active" | "closed"
  closure?: { entryId: string; quote: string; roundIndex: number }
}

export interface ActorMemoryLedger {
  processedCount: number
  lastEntryId: string
  records: ActorMemoryRecord[]
}
