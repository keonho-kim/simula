/**
 * Purpose: Qualify retained-memory semantics and call costs against local Ornith using tiny synthetic input.
 * Pattern: Explicit live qualification runner.
 * Usage: bun scripts/qualify-memory.ts; optional first argument selects a new JSON result path.
 * Related: src/backend/core/simulation/actors/retain-memory.ts, sample-input-items/memory-retention.json
 */
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { z } from "zod"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { applyInteractionContext } from "@/backend/core/simulation/actors/memory"
import { retainActorMemories, retainActorMemory } from "@/backend/core/simulation/actors/retain-memory"
import { runWithModelExecution } from "@/backend/integrations/llm/execution-context"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import type { ActorState, Interaction, RunEvent } from "@/shared"

const MODEL = "ornith-1.5-35b-a3b"
const ENDPOINT = "http://127.0.0.1:1234"
const MAX_CALLS = 100
const DEADLINE_MS = 600_000
const fixturePath = resolve(import.meta.dir, "../sample-input-items/memory-retention.json")
const fixtureSchema = z.object({ speaker: z.string(), readers: z.array(z.string()).length(4),
  publicStatements: z.array(z.string().min(1).max(180)).length(5), privateStatement: z.string().min(1).max(180),
  promiseTerm: z.string(), promiseCondition: z.string(), closureTerm: z.string(), privateTerm: z.string() }).strict()
const catalogSchema = z.object({ models: z.array(z.object({ key: z.string(), quantization: z.unknown().optional(),
  loaded_instances: z.array(z.object({ id: z.string(), config: z.unknown() })) })) })

async function main() {
  const startedAt = new Date().toISOString()
  const fixtureText = await Bun.file(fixturePath).text()
  const fixture = fixtureSchema.parse(JSON.parse(fixtureText))
  const catalogResponse = await fetch(`${ENDPOINT}/api/v1/models`, { signal: AbortSignal.timeout(5000) })
  if (!catalogResponse.ok) throw new Error(`LM Studio catalog returned ${catalogResponse.status}.`)
  const model = catalogSchema.parse(await catalogResponse.json()).models.find(model => model.key === MODEL)
  if (!model?.loaded_instances.some(instance => instance.id === MODEL)) throw new Error(`Load ${MODEL} in local LM Studio before qualification. No alternate model will be used.`)
  if (process.env.SIMULA_TEST_MODEL === "1") throw new Error("Disable SIMULA_TEST_MODEL for real-model qualification.")
  const signal = AbortSignal.timeout(DEADLINE_MS)
  let phase = "baseline"
  const calls: { phase: string; kind: string }[] = []
  // This loopback proxy observes real requests without replacing their model responses.
  const proxy = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 255, async fetch(request) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/v1/chat/completions") return new Response(null, { status: 404 })
    const body = await request.text()
    const envelope = z.object({ model: z.literal(MODEL) }).passthrough().parse(JSON.parse(body))
    if (envelope.model !== MODEL || calls.length >= MAX_CALLS) return new Response("Qualification call budget exhausted", { status: 429 })
    const kind = body.includes("Shared accepted memory extraction.") ? "shared" : body.includes("Recipient retained-memory closure.") ? "closure" : "individual"
    if (phase === "private-probe" && kind === "shared" && body.includes(fixture.privateTerm)) throw new Error("Shared extraction included a recipient's private prior record.")
    calls.push({ phase, kind })
    console.log(JSON.stringify({ phase, call: calls.length, kind }))
    const response = await fetch(`${ENDPOINT}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" },
      body, signal: AbortSignal.any([signal, request.signal]) })
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "text/event-stream" } })
  } })
  const settings = defaultSettings()
  settings.concurrency = 1
  settings.providers.lmstudio = { baseUrl: `http://127.0.0.1:${proxy.port}/v1`, apiKey: "lm-studio", streamUsage: true }
  settings.roles.actor = { provider: "lmstudio", model: MODEL, temperature: 0, maxTokens: 768,
    timeoutSeconds: 60, extraBody: { reasoning_effort: "none" } }
  const metrics: Extract<RunEvent, { type: "model.metrics" }>["metrics"][] = []
  const emit = async (event: RunEvent) => { if (event.type === "model.metrics") metrics.push(event.metrics) }
  const scenario = { text: "작은 예산 검토 회의", language: "ko" as const, controls: { numCast: 5, maxRound: 5,
    actionsPerType: 1, fastMode: false, allowAdditionalCast: false } }
  const execution = { runId: "ornith-memory-qualification", scenario, settings, emit }
  const readers = () => fixture.readers.map((name, index) => buildActor(index + 1,
    { name, role: name, backgroundHistory: "예산 검토 회의 참석", personality: "신중함", preference: "명확한 일정" }, "예산 검토", {}))
  const interaction = (content: string, roundIndex: number, visibility: Interaction["visibility"] = "public"): Interaction => ({
    id: `entry-${roundIndex}`, roundIndex, sourceActorId: "speaker", targetActorIds: ["actor-1"],
    actionType: "발언", content, eventId: "review", visibility, decisionType: "action", intent: "AUTHOR-ONLY-INTENT", expectation: "AUTHOR-ONLY-EXPECTATION",
  })
  const outcomes: { phase: string; elapsedMs: number; calls: number; byKind: Record<string, number>; active: number[] }[] = []
  const verify = (actors: ActorState[], round: number) => {
    for (const actor of actors) {
      const promises = actor.context.ledger?.records.filter(record => record.kind === "commitment" && record.quote.includes(fixture.promiseTerm)) ?? []
      if (!promises.length) throw new Error(`${phase}: ${actor.id} lost the stated promise at round ${round}.`)
      if (!promises.some(record => record.quote.includes(fixture.promiseCondition))) throw new Error(`${phase}: the promise lost its deadline condition.`)
      if (round < 3 && !promises.some(record => record.status === "active")) throw new Error(`${phase}: promise closed without fulfillment.`)
      if (round >= 3 && promises.some(record => record.status !== "closed" || !record.closure?.quote.includes(fixture.closureTerm))) {
        throw new Error(`${phase}: fulfillment did not close the promise for ${actor.id}.`)
      }
      if (round >= 3 && actor.context.ledger?.records.some(record => record.status === "active")) {
        throw new Error(`${phase}: completed or incidental speech created an unsupported active record.`)
      }
    }
  }
  let failure: string | undefined
  try {
    await runWithModelExecution({ owner: execution.runId, admission: new ModelAdmission({ concurrency: 1 }), signal }, async () => {
      for (const mode of ["baseline", "shared"] as const) {
        phase = mode
        let actors = readers()
        const offset = calls.length
        const start = performance.now()
        for (const [index, statement] of fixture.publicStatements.entries()) {
          actors = applyInteractionContext(actors, interaction(`${fixture.speaker}: ${statement}`, index + 1))
          if (mode === "shared") actors = await retainActorMemories(actors, execution, false)
          else {
            const next: ActorState[] = []
            for (const actor of actors) next.push(await retainActorMemory(actor, execution))
            actors = next
          }
          verify(actors, index + 1)
        }
        const count = calls.length
        await retainActorMemories(actors, execution, false)
        if (calls.length !== count) throw new Error("Replaying accepted memory made another model call.")
        const observed = calls.slice(offset)
        const byKind: Record<string, number> = {}
        for (const call of observed) byKind[call.kind] = (byKind[call.kind] ?? 0) + 1
        outcomes.push({ phase, elapsedMs: performance.now() - start, calls: observed.length, byKind,
          active: actors.map(actor => actor.context.ledger?.records.filter(record => record.status === "active").length ?? 0) })
      }
      phase = "private"
      const actors = applyInteractionContext(readers(), interaction(fixture.privateStatement, 1, "private"))
      let retained = await retainActorMemories(actors, execution, false)
      if (!retained[0]?.context.ledger?.records.some(record => record.quote.includes(fixture.privateTerm))) throw new Error("Private promise was not retained by its recipient.")
      if (retained.slice(1).some(actor => actor.context.visible.length || actor.context.ledger?.records.length)) throw new Error("Private content reached an outsider.")
      phase = "private-probe"
      retained = await retainActorMemories(applyInteractionContext(retained, interaction("화면의 글자가 잘 보입니다.", 2)), execution, false)
      if (!retained[0]?.context.ledger?.records.some(record => record.status === "active" && record.quote.includes(fixture.privateTerm))) {
        throw new Error("Unrelated public speech erased the recipient's private promise.")
      }
      if (retained.slice(1).some(actor => actor.context.ledger?.records.some(record => record.quote.includes(fixture.privateTerm)))) throw new Error("Closure sharing leaked private knowledge.")
      phase = "public-disclosure"
      retained = await retainActorMemories(applyInteractionContext(retained, interaction(fixture.privateStatement, 3)), execution, false)
      if (retained.some(actor => !actor.context.ledger?.records.some(record => record.quote.includes(fixture.privateTerm)))) throw new Error("Accepted public disclosure did not reach every reader.")
      const baseline = outcomes[0]
      const shared = outcomes[1]
      if (!baseline || !shared || shared.calls >= baseline.calls) throw new Error("Total shared-path calls did not improve over individual processing.")
    })
  } catch (error) { failure = error instanceof Error ? error.message : "Qualification failed." }
  finally { await proxy.stop(true) }
  const output = resolve(process.argv[2] ?? `output/qualification/memory-${Date.now()}.json`)
  const revision = (await Bun.$`git rev-parse HEAD`.quiet().text()).trim()
  const dirty = Boolean((await Bun.$`git status --porcelain`.quiet().text()).trim())
  const report = { startedAt, finishedAt: new Date().toISOString(), revision, dirty, model: MODEL,
    quantization: model.quantization, loaded: model.loaded_instances, fixture: "sample-input-items/memory-retention.json",
    fixtureSha256: createHash("sha256").update(fixtureText).digest("hex"), maxOutputTokens: 768,
    reasoningEffort: "none", concurrency: 1, fastMode: false, outcomes, totalCalls: calls.length, metrics,
    status: failure ? "failed" : "passed", failure,
    scope: "Four recipients, five public entries and one private entry; extraction/closure only. Author processing and ordinary compression are excluded equally. Single ordered run, not a throughput benchmark." }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
  console.log(JSON.stringify({ output, status: report.status, outcomes, totalCalls: calls.length, failure }))
  if (failure) process.exitCode = 1
}

await main()
