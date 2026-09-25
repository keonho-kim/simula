/**
 * Purpose: Ingest visible entries with one shared extraction per identical recipient interaction.
 * Pattern: Use case with bounded model repair.
 * Usage: Called before actor compression and after the last accepted round.
 * Related: src/backend/core/simulation/actors/memory-records.ts, src/backend/core/simulation/actors/prompts/memory-addition.ts
 */
import type { ActorState, ActorVisibleContextEntry, LLMSettings, RunEvent, ScenarioInput } from "@/shared"
import { assertCompleteModelOutput, invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { emitModelTelemetry } from "../events/telemetry"
import { activeMemoryRecords, applyMemoryUpdate, parseMemoryUpdate, MEMORY_CHANGES_PER_ENTRY, MEMORY_QUOTE_CHARS } from "./memory-records"
import { groupMemoryClosures } from "./memory-closure-groups"
import { memoryAddition } from "./prompts/memory-addition"
import { memoryKind } from "./prompts/memory-kind"
import { memoryClosure } from "./prompts/memory-closure"
import { memoryClosureQuote } from "./prompts/memory-closure-quote"

const MAX_ATTEMPTS = 3
const MAX_ENTRY_CHARS = 6000
const MAX_REQUEST_CHARS = 14000
const MEMORY_KINDS = ["commitment", "decision", "authority", "constraint", "unresolved"] as const

export interface ActorMemoryExecution {
  runId: string
  scenario: ScenarioInput
  settings: LLMSettings
  emit: (event: RunEvent) => Promise<void>
}

interface MemoryGroup {
  members: { index: number; entry: ActorVisibleContextEntry }[]
}

export async function retainActorMemory(actor: ActorState, input: ActorMemoryExecution): Promise<ActorState> {
  let current = actor
  while (true) {
    const entry = nextVisibleEntry(current)
    if (!entry) return current
    current = await retainOneEntry(current, entry, input)
  }
}

export async function retainActorMemories(actors: ActorState[], input: ActorMemoryExecution, fastMode: boolean): Promise<ActorState[]> {
  const groups = new Map<string, MemoryGroup>()
  actors.forEach((actor, index) => {
    nextVisibleEntry(actor)
    const start = actor.context.ledger?.processedCount ?? 0
    for (const entry of actor.context.visible.slice(start)) {
      const key = entry.interactionId && entry.sourceActorId !== actor.id
        ? JSON.stringify(["shared", entry.interactionId, entry.roundIndex, entry.content, entry.visibility,
          entry.sourceActorId, entry.sourceActorName, entry.targetActorIds])
        : JSON.stringify(["individual", index, entry.id])
      const group = groups.get(key)
      if (group) group.members.push({ index, entry })
      else groups.set(key, { members: [{ index, entry }] })
    }
  })
  const pending = Array.from(groups.values())
  let current = actors
  while (pending.length) {
    const actorAt = (index: number) => {
      const actor = current[index]
      if (!actor) throw new Error("Actor memory group references an absent actor.")
      return actor
    }
    const ready = pending.filter(group => group.members.every(member =>
      nextVisibleEntry(actorAt(member.index))?.id === member.entry.id))
    if (!ready.length) throw new Error("Actor memory histories have conflicting accepted-entry order.")
    const selected = fastMode ? ready : ready.slice(0, 1)
    const results = await Promise.all(selected.map(async group => {
      const first = group.members[0]
      if (!first) throw new Error("Actor memory group is empty.")
      if (group.members.length > 1) {
        return retainSharedEntry(group.members.map(member => actorAt(member.index)), first.entry, input, fastMode)
      }
      return [await retainOneEntry(actorAt(first.index), first.entry, input)]
    }))
    const next = [...current]
    selected.forEach((group, groupIndex) => {
      group.members.forEach((member, actorIndex) => {
        const retained = results[groupIndex]?.[actorIndex]
        if (!retained) throw new Error("Actor memory group omitted a reader.")
        next[member.index] = retained
      })
      pending.splice(pending.indexOf(group), 1)
    })
    current = next
  }
  return current
}

function nextVisibleEntry(actor: ActorState): ActorVisibleContextEntry | undefined {
  const ledger = actor.context.ledger
  const start = ledger?.processedCount ?? 0
  if (start > actor.context.visible.length || (start > 0 && actor.context.visible[start - 1]?.id !== ledger?.lastEntryId)) {
    throw new Error("Actor memory cursor does not match accepted history.")
  }
  return actor.context.visible[start]
}

async function retainOneEntry(actor: ActorState, entry: ActorVisibleContextEntry, input: ActorMemoryExecution): Promise<ActorState> {
  const ledger = actor.context.ledger
  const update = await requestUpdate(entry, activeMemoryRecords(ledger), input, "both", { actorId: actor.id, actorName: actor.name })
  return withUpdate(actor, entry, update)
}

async function retainSharedEntry(actors: ActorState[], entry: ActorVisibleContextEntry, input: ActorMemoryExecution, fastMode: boolean): Promise<ActorState[]> {
  const shared = await requestUpdate(entry, [], input, "additions")
  const readers = actors.map(actor => {
    const recipientEntry = nextVisibleEntry(actor)
    if (!recipientEntry) throw new Error("Shared memory reader has no pending accepted entry.")
    return { actor, entry: recipientEntry }
  })
  const closeGroup = async (group: ReturnType<typeof groupMemoryClosures>[number]) => {
    const first = group.readers[0]
    if (!first) throw new Error("Closure group has no reader.")
    const closure = group.records.length ? await requestUpdate(first.entry, group.records, input, "closures") : undefined
    return group.readers.map(reader => withUpdate(reader.actor, reader.entry, { additions: shared.additions,
      closures: (closure?.closures ?? []).map(change => {
        const recordId = reader.recordIds[group.records.findIndex(record => record.id === change.recordId)]
        if (!recordId) throw new Error("Closure result has no reader-local record.")
        return { ...change, recordId }
      }),
    }))
  }
  const groups = groupMemoryClosures(readers)
  const retained: ActorState[] = []
  if (fastMode) retained.push(...(await Promise.all(groups.map(closeGroup))).flat())
  else for (const group of groups) retained.push(...await closeGroup(group))
  const byId = new Map(retained.map(actor => [actor.id, actor]))
  return actors.map(actor => {
    const result = byId.get(actor.id)
    if (!result) throw new Error("Closure processing omitted a reader.")
    return result
  })
}

async function requestUpdate(
  entry: ActorVisibleContextEntry,
  records: Parameters<typeof parseMemoryUpdate>[2],
  input: ActorMemoryExecution,
  mode: "both" | "additions" | "closures",
  actor?: { actorId: string; actorName: string }
): Promise<ReturnType<typeof parseMemoryUpdate>> {
  if (entry.content.length > MAX_ENTRY_CHARS) throw new Error("Actor memory entry exceeds the retained-memory input budget.")
  const additions: ReturnType<typeof parseMemoryUpdate>["additions"] = []
  const closures: ReturnType<typeof parseMemoryUpdate>["closures"] = []
  try {
    if (mode !== "closures") {
      for (let index = 0; index < MEMORY_CHANGES_PER_ENTRY; index++) {
        const quote = await requestField(input, actor, feedback => memoryAddition(entry, records,
          additions.map(value => value.quote), mode === "additions", feedback), undefined, text => {
          const value = text.trim()
          if (value === "0") return value
          if (value.length < 4 || value.length > MEMORY_QUOTE_CHARS || !entry.content.includes(value)
            || additions.some(change => change.quote === value)) throw new Error("Choose one new exact current-entry quote or 0.")
          return value
        })
        if (quote === "0") break
        const kind = await requestField(input, actor, feedback => memoryKind(entry, quote, feedback), [...MEMORY_KINDS], text => {
          const value = text.trim()
          const selected = MEMORY_KINDS.find(kind => kind === value)
          if (!selected) throw new Error("Choose one supplied memory kind.")
          return selected
        })
        additions.push({ kind, quote })
      }
    }
    if (mode !== "additions") {
      for (let index = 0; index < MEMORY_CHANGES_PER_ENTRY; index++) {
        const available = records.filter(record => record.status === "active" && record.sourceEntryId !== entry.id
          && record.roundIndex <= entry.roundIndex && !closures.some(change => change.recordId === record.id))
        if (!available.length) break
        const choices = Array.from({ length: available.length + 1 }, (_, choice) => String(choice))
        const selected = await requestField(input, actor, feedback => memoryClosure(entry, available,
          closures.map(value => value.recordId), feedback), choices, text => {
          const value = text.trim()
          if (!choices.includes(value)) throw new Error("Choose one supplied active record index or 0.")
          return Number(value)
        })
        if (selected === 0) break
        const record = available[selected - 1]
        if (!record) throw new Error("Selected memory record is unavailable.")
        const quote = await requestField(input, actor, feedback => memoryClosureQuote(entry, record, feedback), undefined, text => {
          const value = text.trim()
          if (value.length < 4 || value.length > MEMORY_QUOTE_CHARS || !entry.content.includes(value)) {
            throw new Error("Copy exact closure evidence from the current visible entry.")
          }
          return value
        })
        closures.push({ recordId: record.id, quote })
      }
    }
  } catch (error) {
    if (!(error instanceof MemoryFieldFailure)) throw error
    await input.emit({ type: "log", runId: input.runId, timestamp: new Date().toISOString(), level: "warn",
      message: `Actor retained memory update incomplete for ${actor?.actorId ?? "shared readers"} after ${MAX_ATTEMPTS} attempts; accepted records and visible history remain available.` })
  }
  return parseMemoryUpdate({ additions, closures }, entry, records)
}

class MemoryFieldFailure extends Error {}

async function requestField<T>(input: ActorMemoryExecution, actor: { actorId: string; actorName: string } | undefined,
  promptFor: (feedback: string) => string, choices: string[] | undefined, parse: (text: string) => T): Promise<T> {
  let feedback = ""
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = withRolePromptGuide(promptFor(feedback), { language: input.scenario.language, settings: input.settings, role: "actor" })
    if (prompt.length > MAX_REQUEST_CHARS) throw new Error("Actor retained-memory request exceeds its input budget.")
    const result = choices ? await invokeExactChoiceWithMetrics(input.settings, "actor", "context", attempt, prompt, choices)
      : await invokeRoleTextWithMetrics(input.settings, "actor", "context", attempt, prompt)
    await emitModelTelemetry(input.runId, result, input.emit, actor)
    try {
      assertCompleteModelOutput(result)
      return parse(result.text)
    } catch {
      // Model drafts can contain private data; only the failed contract enters diagnostics.
      feedback = "Return one complete supplied choice or exact current-entry quote."
    }
  }
  throw new MemoryFieldFailure(feedback)
}

function withUpdate(actor: ActorState, entry: ActorVisibleContextEntry, update: ReturnType<typeof parseMemoryUpdate>): ActorState {
  const ledger = applyMemoryUpdate(actor.context.ledger, entry, update, actor.id)
  return { ...actor, context: { ...actor.context, ledger } }
}
