/**
 * Purpose: Define per-card input context and the runtime dependencies kept outside graph channels.
 * Pattern: Explicit execution dependency contract.
 * Usage: Supplied by Generator when constructing one independent card graph.
 * Related: src/backend/core/simulation/roles/generator/cards/graph.ts, src/backend/core/simulation/roles/generator/cards/node.ts
 */
import type { ActorRosterEntry, LLMSettings, PromptLanguage, RunEvent } from "@/shared"

export interface ActorCardContext {
  runId: string
  language?: PromptLanguage
  actorIndex: number
  assignedName: string
  roleSeed: string
  fullRoster: ActorRosterEntry[]
  plannerDigest: string
}

export interface ActorCardExecution {
  context: ActorCardContext
  settings: LLMSettings
  emit: (event: RunEvent) => Promise<void>
}
