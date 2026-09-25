/**
 * Purpose: Verify world commands retain order, reject future approvals, and cannot cross execution generations.
 * Pattern: Durable command contract tests.
 * Usage: bun test src/backend/storage/multiverse/world-commands.test.ts
 * Related: src/backend/storage/multiverse/world-commands.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { ExecutionOwnership } from "../generation/execution-lease"
import { BatchStore } from "./batch-store"
import { MAX_PENDING_WORLD_COMMANDS } from "./world-commands"

test("world controls preserve order and accept one current-round approval without queuing its duplicates", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-world-command-"))
  try {
    const store = new BatchStore(root)
    const batch = await store.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: crypto.randomUUID(), controls: {}, worldCount: 2 }), 1)
    const lease = store.execution(batch.id).claim()
    if (!lease) throw new Error("Missing owner")
    const world = batch.worlds[0]!.id
    const controls = new BatchStore(root).commands(batch.id)
    await store.update(batch.id, value => ({ ...value, worlds: value.worlds.map(w => w.id === world ? { ...w, status: "waiting", roundIndex: 1 } : w) }), lease)
    controls.enqueue(world, { kind: "automatic", enabled: false })
    controls.enqueue(world, { kind: "automatic", enabled: true })
    expect(() => controls.enqueue(world, { kind: "continue", roundIndex: 2 })).toThrow("waiting round")
    controls.enqueue(world, { kind: "continue", roundIndex: 1 })
    controls.enqueue(world, { kind: "continue", roundIndex: 1 })
    expect(() => controls.enqueue(crypto.randomUUID(), { kind: "cancel" })).toThrow("belong")
    const commands = controls.pending(lease)
    expect(commands.map(command => command.input)).toEqual([
      { kind: "automatic", enabled: false }, { kind: "automatic", enabled: true }, { kind: "continue", roundIndex: 1 },
    ])
    for (const command of commands) controls.acknowledge(command.id, lease)
    controls.enqueue(world, { kind: "continue", roundIndex: 1 })
    expect(controls.pending(lease)).toEqual([])
    controls.enqueue(world, { kind: "cancel" })
    expect(() => controls.enqueue(world, { kind: "automatic", enabled: false })).toThrow("canceled")
    const replacement = new ExecutionOwnership(join(root, batch.id), () => lease.expiresAt + 1).claim()
    if (!replacement) throw new Error("Missing successor")
    expect(controls.pending(replacement)).toEqual([])
    expect(() => controls.acknowledge(commands[0]!.id, lease)).toThrow("ownership")
    replacement.release()
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("a bounded progress queue still reserves capacity for scoped cancellation", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-world-command-limit-"))
  try {
    const store = new BatchStore(root)
    const batch = await store.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: crypto.randomUUID(), controls: {}, worldCount: 2 }), 1)
    const lease = store.execution(batch.id).claim()
    if (!lease) throw new Error("Missing owner")
    const inbox = store.commands(batch.id)
    let accepted = 0
    for (; accepted < MAX_PENDING_WORLD_COMMANDS; accepted++) {
      try { inbox.enqueue(batch.worlds[0]!.id, { kind: "automatic", enabled: accepted % 2 === 0 }) }
      catch (error) { expect(String(error)).toContain("queue is full"); break }
    }
    expect(accepted).toBeGreaterThan(0)
    expect(accepted).toBeLessThan(MAX_PENDING_WORLD_COMMANDS)
    inbox.enqueue(batch.worlds[1]!.id, { kind: "cancel" })
    expect(inbox.pending(lease)).toHaveLength(accepted + 1)
    expect(inbox.pending(lease).at(-1)?.input.kind).toBe("cancel")
    lease.release()
    expect(() => inbox.enqueue(batch.worlds[0]!.id, { kind: "cancel" })).toThrow("active batch")
  } finally { await rm(root, { recursive: true, force: true }) }
})
