/**
 * Purpose: Queue bounded world controls for one active batch in a Bun process.
 * Pattern: Process-scoped command inbox.
 * Usage: API handlers enqueue; the batch supervisor reads and acknowledges commands.
 * Related: src/backend/storage/generation/execution-lease.ts, src/backend/runtime/multiverse/controls.ts
 */
import { resolve } from "node:path"
import { z } from "zod"
import { MAX_BATCH_WORLDS, type BatchWorldCommand, type MultiverseRecord } from "@/shared/multiverse"
import { ExecutionOwnership, type ExecutionLease } from "../generation/execution-lease"

export const MAX_PENDING_WORLD_COMMANDS = 200
const MAX_PENDING_PROGRESS_COMMANDS = MAX_PENDING_WORLD_COMMANDS - MAX_BATCH_WORLDS
const inputSchema: z.ZodType<BatchWorldCommand> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("automatic"), enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal("continue"), roundIndex: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ kind: z.literal("cancel") }).strict(),
])

export interface WorldCommand { id: number; worldId: string; input: BatchWorldCommand }
interface Receipt { approvedRound: number; canceled: boolean }
interface Inbox { generation: number; nextId: number; commands: WorldCommand[]; receipts: Map<string, Receipt> }
const inboxes = new Map<string, Inbox>()

export class WorldCommands {
  private readonly path: string
  constructor(directory: string, private readonly readRecord: () => MultiverseRecord) { this.path = resolve(directory) }

  enqueue(worldId: string, value: BatchWorldCommand): void {
    const input = inputSchema.parse(value)
    z.uuid().parse(worldId)
    const generation = new ExecutionOwnership(this.path).activeGeneration()
    if (generation === undefined) throw new Error("Choose an active batch execution.")
    const world = this.readRecord().worlds.find(item => item.id === worldId)
    if (!world) throw new Error("World does not belong to this batch.")
    const inbox = this.inbox(generation)
    const receipt = inbox.receipts.get(worldId) ?? { approvedRound: 0, canceled: false }
    if (input.kind === "continue" && receipt.approvedRound === input.roundIndex) return
    if (input.kind === "cancel" && (receipt.canceled || world.status === "canceled")) return
    if (receipt.canceled) throw new Error("This world has been canceled.")
    if (["completed", "failed", "canceled", "interrupted"].includes(world.status)) throw new Error("Choose an active world.")
    if (input.kind === "continue" && (world.status !== "waiting" || world.roundIndex !== input.roundIndex)) {
      throw new Error("Approve only this world's current waiting round.")
    }
    const progressCount = inbox.commands.filter(command => command.input.kind !== "cancel").length
    if (input.kind !== "cancel" && progressCount >= MAX_PENDING_PROGRESS_COMMANDS) {
      throw new Error("World control queue is full; retry after pending commands are applied.")
    }
    inbox.commands.push({ id: ++inbox.nextId, worldId, input })
    inbox.receipts.set(worldId, { approvedRound: input.kind === "continue" ? input.roundIndex : receipt.approvedRound,
      canceled: input.kind === "cancel" || receipt.canceled })
  }

  pending(lease: ExecutionLease): WorldCommand[] {
    lease.assertScope(this.path)
    lease.assertActive()
    return this.inbox(lease.generation).commands.slice(0, MAX_PENDING_WORLD_COMMANDS)
  }

  acknowledge(id: number, lease: ExecutionLease): void {
    lease.assertScope(this.path)
    lease.assertActive()
    const inbox = this.inbox(lease.generation)
    inbox.commands = inbox.commands.filter(command => command.id !== id)
  }

  automatic(worldId: string, lease: ExecutionLease): boolean {
    lease.assertScope(this.path)
    lease.assertActive()
    const world = this.readRecord().worlds.find(value => value.id === worldId)
    if (!world) throw new Error("World does not belong to this batch.")
    return world.autoContinue
  }

  private inbox(generation: number): Inbox {
    const current = inboxes.get(this.path)
    if (current?.generation === generation) return current
    const next: Inbox = { generation, nextId: 0, commands: [], receipts: new Map() }
    inboxes.set(this.path, next)
    return next
  }
}
