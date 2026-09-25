/**
 * Purpose: Project source material and recorded world behavior into bounded, traceable evidence fragments.
 * Pattern: Pure boundary parsing and evidence projection.
 * Usage: Called by analysis preparation before any interpretation task.
 * Related: src/backend/core/documents/text.ts, src/shared/analytical-report.ts
 */
import { createHash } from "node:crypto"
import { z } from "zod"
import type { AnalysisReference } from "@/shared/analytical-report"
import { extractTextEvidence } from "@/backend/core/documents/text"

const MAX_OBSERVATIONS = 20_000
const MAX_TEXT_CHARS = 128 * 1024
const text = z.string().max(MAX_TEXT_CHARS)
const index = z.number().int().positive()
const worldSchema = z.object({
  runId: z.string(), actors: z.array(z.object({ id: z.string(), name: text, role: text, personality: text.optional() })).max(500),
  interactions: z.array(z.object({ id: z.string(), roundIndex: index, sourceActorId: z.string(), targetActorIds: z.array(z.string()).max(500),
    actionType: text, content: text, intent: text })).max(MAX_OBSERVATIONS),
  roundReports: z.array(z.object({ roundIndex: index, title: text, roundSummary: text })).max(MAX_OBSERVATIONS),
  roundDigests: z.array(z.object({ roundIndex: index, preRound: z.object({ content: text }) })).max(MAX_OBSERVATIONS),
  stopReason: z.string(),
})

export function analysisIdentity(value: string): string { return createHash("sha256").update(value).digest("hex").slice(0, 24) }

export function textReferences(id: string, content: string, category: AnalysisReference["category"], location: Partial<AnalysisReference> = {}): AnalysisReference[] {
  if (!content.trim()) return []
  return extractTextEvidence(id, new TextEncoder().encode(content)).blocks.map(block => ({ ...location, id: block.id, text: block.content, category }))
}

export function worldReferences(input: unknown, runId: string): AnalysisReference[] {
  const world = worldSchema.parse(input)
  if (world.runId !== runId) throw new Error("Report world identity mismatch.")
  const actors = new Map(world.actors.map(actor => [actor.id, actor.name]))
  const references: AnalysisReference[] = []
  const add = (kind: string, recordId: string, content: string, roundIndex?: number) => {
    references.push(...textReferences(`obs-${analysisIdentity(`${runId}:${kind}:${recordId}`)}`, content,
      kind === "actor" ? "scenario_assumption" : kind === "round-summary" || kind === "termination" ? "analytical_interpretation" : "simulation_observation", { runId, recordId, roundIndex }))
  }
  for (const actor of world.actors) add("actor", actor.id, `Fictional participant: ${actor.name}\nRole: ${actor.role}\nPersonality: ${actor.personality ?? "unspecified"}`)
  for (const digest of world.roundDigests) add("situation", String(digest.roundIndex), `Simulated pre-round event pressure: ${digest.preRound.content}`, digest.roundIndex)
  for (const interaction of world.interactions) add("interaction", interaction.id,
    `Simulated interaction:\nActor: ${actors.get(interaction.sourceActorId) ?? interaction.sourceActorId}\nTargets: ${interaction.targetActorIds.map(id => actors.get(id) ?? id).join(", ")}\nAction: ${interaction.actionType}\nIntent: ${interaction.intent}\nRecorded speech/action: ${interaction.content}`, interaction.roundIndex)
  for (const round of world.roundReports) add("round-summary", String(round.roundIndex), `Observer interpretation of simulated round: ${round.title}\n${round.roundSummary}`, round.roundIndex)
  add("termination", "termination", `Simulated world terminal reason: ${world.stopReason}`)
  return references.sort((a, b) => (a.roundIndex ?? Number.MAX_SAFE_INTEGER) - (b.roundIndex ?? Number.MAX_SAFE_INTEGER))
}
