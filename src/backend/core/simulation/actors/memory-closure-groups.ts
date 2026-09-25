/**
 * Purpose: Group only identical known memory and current evidence for one shared closure decision.
 * Pattern: Pure projection with reader-local identity mapping.
 * Usage: Called within one accepted interaction group; no cache survives the invocation.
 * Related: src/backend/core/simulation/actors/retain-memory.ts, src/backend/core/simulation/actors/memory-records.ts
 */
import type { ActorState, ActorVisibleContextEntry } from "@/shared"
import type { ActorMemoryRecord } from "@/shared/actor-memory"
import { activeMemoryRecords } from "./memory-records"

interface MemoryReader { actor: ActorState; entry: ActorVisibleContextEntry }
interface ClosureGroup {
  records: ActorMemoryRecord[]
  readers: (MemoryReader & { recordIds: string[] })[]
}

export function groupMemoryClosures(readers: MemoryReader[]): ClosureGroup[] {
  const groups = new Map<string, ClosureGroup>()
  for (const reader of readers) {
    const records = activeMemoryRecords(reader.actor.context.ledger).map(record => {
      const source = reader.actor.context.visible.find(entry => entry.id === record.sourceEntryId)
      if (!source) throw new Error("Retained memory refers to an absent visible entry.")
      const key = JSON.stringify([source.interactionId ?? source.id, source.visibility, source.targetActorIds,
        record.kind, record.quote, record.sourceActorId, record.sourceActorName, record.roundIndex])
      return { key, record }
    }).sort((a, b) => a.key.localeCompare(b.key))
    const key = JSON.stringify([reader.entry.interactionId ?? reader.entry.id, reader.entry.visibility, reader.entry.targetActorIds,
      reader.entry.content, reader.entry.roundIndex, reader.entry.sourceActorId,
      reader.entry.sourceActorName, records.map(record => record.key)])
    const member = { ...reader, recordIds: records.map(({ record }) => record.id) }
    const existing = groups.get(key)
    if (existing) existing.readers.push(member)
    else groups.set(key, { readers: [member], records: records.map(({ record }, index) => ({ ...record, id: `R${index + 1}` })) })
  }
  return [...groups.values()]
}
