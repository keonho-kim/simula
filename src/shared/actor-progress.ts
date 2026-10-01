/**
 * Purpose: Define and parse transient actor completion updates independently of saved interactions.
 * Pattern: Serializable stream contract with boundary parsing.
 * Usage: Shared by runtime actor progress and the visible simulation subscription.
 * Related: src/shared/run.ts, src/backend/runtime/actor-progress.ts, src/ui/hooks/use-actor-progress.ts
 */
import { z } from "zod"

export const ACTOR_PROGRESS_MAX_BYTES = 8 * 1024 * 1024
export const ACTOR_PROGRESS_RECONNECT_MS = 1000
const identifier = z.string().min(1).max(200)
const text = z.string().max(32 * 1024)
const messageSchema = z.object({
  id: identifier, actorId: identifier, actorName: text, role: text, targets: z.array(text),
  action: text, content: text, visibility: z.enum(["public", "semi-public", "private", "solitary"]),
  decisionType: z.enum(["action", "no_action"]),
})
export type ActorPreviewMessage = z.infer<typeof messageSchema>
export type ActorProgressUpdate =
  | { kind: "round"; roundIndex: number; parallel: boolean; actors: Array<{ id: string; name: string }> }
  | { kind: "started"; roundIndex: number; actorId: string }
  | { kind: "ready"; roundIndex: number; message: ActorPreviewMessage }
const snapshotSchema = z.object({
  runId: identifier, streamId: identifier, revision: z.number().int().positive(), roundIndex: z.number().int().nonnegative(),
  parallel: z.boolean(), status: z.enum(["running", "completed", "failed", "canceled"]),
  turns: z.array(z.object({ actorId: identifier, actorName: text, status: z.enum(["waiting", "working", "ready", "committed"]),
    order: z.number().int().nonnegative().optional(), message: messageSchema.optional(), timestamp: z.string() })),
})
export type ActorProgressSnapshot = z.infer<typeof snapshotSchema>
export function parseActorProgress(value: unknown, runId: string): ActorProgressSnapshot {
  const snapshot = snapshotSchema.parse(value)
  if (snapshot.runId !== runId) throw new Error("Actor progress belongs to a different run.")
  const seen = new Set<string>()
  for (const turn of snapshot.turns) {
    if (seen.has(turn.actorId)) throw new Error("Duplicate actor progress.")
    seen.add(turn.actorId)
    if (turn.message && (turn.message.actorId !== turn.actorId || turn.message.id !== `round-${snapshot.roundIndex}-${turn.actorId}`)) {
      throw new Error("Actor progress interaction does not match its scope.")
    }
    if (turn.status === "ready" && (!turn.message || turn.order === undefined)) throw new Error("Missing ready actor message.")
  }
  return snapshot
}
