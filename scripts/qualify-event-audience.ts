/**
 * Purpose: Qualify Planner event recipients, failure isolation and reuse against local Ornith.
 * Pattern: Bounded live module qualification.
 * Usage: bun scripts/qualify-event-audience.ts; optional first argument selects a new result path.
 * Related: src/backend/core/simulation/roles/planner/events/assignment.ts, sample-input-items/event-audience.json
 */
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { z } from "zod"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { assignEventAudiences } from "@/backend/core/simulation/roles/planner/events/assignment"
import { injectedEventForRound, projectEventForActor } from "@/backend/core/simulation/events/injection"
import { runWithModelExecution } from "@/backend/integrations/llm/execution-context"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { RunStore } from "@/backend/storage/runs/run-store"
import type { ModelMetrics, RunEvent, SimulationState } from "@/shared"

const MODEL = "ornith-1.5-35b-a3b"
const ENDPOINT = "http://127.0.0.1:1234"
const DEADLINE_MS = 600_000
const MAX_CALLS = 20
const inputPath = resolve(import.meta.dir, "../sample-input-items/event-audience.json")

async function main() {
  if (process.env.SIMULA_TEST_MODEL === "1") throw new Error("Disable mock inference for live qualification.")
  const fixtureText = await Bun.file(inputPath).text()
  const eventSchema = z.object({ title: z.string(), summary: z.string() })
  const fixture = z.object({ participants: z.array(z.string()).length(3),
    events: z.array(eventSchema.extend({ expected: z.array(z.string()) })).length(3), ambiguous: eventSchema }).parse(JSON.parse(fixtureText))
  const response = await fetch(`${ENDPOINT}/api/v1/models`, { signal: AbortSignal.timeout(5000) })
  const catalog = z.object({ models: z.array(z.object({ key: z.string(), quantization: z.unknown().optional(),
    loaded_instances: z.array(z.object({ id: z.string(), config: z.unknown() })) })) }).parse(await response.json())
  const model = catalog.models.find(model => model.key === MODEL)
  if (!response.ok || !model?.loaded_instances.some(instance => instance.id === MODEL)) throw new Error(`Load ${MODEL} in local LM Studio.`)
  const settings = defaultSettings()
  settings.concurrency = 1
  settings.providers.lmstudio = { baseUrl: `${ENDPOINT}/v1`, apiKey: "lm-studio", streamUsage: true }
  settings.roles.planner = { provider: "lmstudio", model: MODEL, temperature: 0, maxTokens: 384,
    timeoutSeconds: 60, extraBody: { reasoning_effort: "none" } }
  const scenario = { text: "세 사람의 작은 발표 준비 회의", language: "ko" as const,
    controls: { numCast: 3, maxRound: 3, actionsPerType: 1, fastMode: true, allowAdditionalCast: false } }
  const rootDir = await mkdtemp(join(tmpdir(), "simula-event-audience-"))
  const store = new RunStore({ rootDir })
  const run = await store.createRun(scenario)
  const lease = store.execution(run.id).claim()
  if (!lease) throw new Error("Cannot acquire qualification storage ownership.")
  const initial: SimulationState = { ...initialSimulationState(run.id, scenario),
    actors: fixture.participants.map((name, index) => buildActor(index + 1,
      { name, role: "회의 참석자", backgroundHistory: "발표 준비", personality: "신중함", preference: "근거 확인" }, "회의", {})),
    plan: { interpretation: "발표 준비", backgroundStory: "세 사람이 회의를 준비한다.", actionCatalog: {},
      majorEvents: [...fixture.events, fixture.ambiguous].map((event, index) => ({ id: `event-${index + 1}`,
        title: event.title, summary: event.summary, status: "pending", participantIds: [] })) },
  }
  const calls: ModelMetrics[] = []
  const warnings: string[] = []
  const emit = async (event: RunEvent) => {
    if (event.type === "model.metrics") { calls.push(event.metrics); console.log(JSON.stringify({ call: calls.length, attempt: event.metrics.attempt })) }
    if (event.type === "log") warnings.push(event.message)
  }
  let admitted = 0
  const pool = new ModelAdmission({ concurrency: 1 })
  const admission = { acquire: async (key: string, owner: string, signal?: AbortSignal) => {
    if (++admitted > MAX_CALLS) throw new Error("Event qualification call budget exhausted.")
    return pool.acquire(key, owner, signal)
  } }
  const start = performance.now()
  let failure: string | undefined
  let audiences: (string[] | undefined)[] = []
  const checks: string[] = []
  try {
    await runWithModelExecution({ owner: run.id, admission, signal: AbortSignal.timeout(DEADLINE_MS) }, async () => {
      const assigned = await assignEventAudiences(initial, settings, emit, state => store.writeState(state, lease))
      if (assigned.plan?.majorEvents[3]?.status !== "missed") throw new Error("Ambiguous event was not safely skipped after bounded repair.")
      const saved = await new RunStore({ rootDir }).readState(run.id)
      if (!saved?.plan) throw new Error("Accepted sibling audiences were not persisted.")
      audiences = saved.plan.majorEvents.map(event => event.visibleToActorIds)
      fixture.events.forEach((expected, index) => {
        if (JSON.stringify(audiences[index]) !== JSON.stringify(expected.expected)) throw new Error(`Wrong recipients for event-${index + 1}.`)
      })
      if (audiences[3]?.length !== 0) throw new Error("Ambiguous event acquired recipients.")
      checks.push("public/private/group classification", "bounded unresolved skip", "accepted siblings survive reopen")
      const privateEvent = saved.plan.majorEvents[1]!
      const injected = injectedEventForRound(1, privateEvent, saved.actors)
      if (injected.visibleToActorIds?.join() !== "actor-1" || projectEventForActor(privateEvent, "actor-2").visible) throw new Error("Private injection exposed the event.")
      checks.push("private injection filtering")
      const completed = { ...saved, plan: { ...saved.plan, majorEvents: saved.plan.majorEvents.slice(0, 3) } }
      const count = calls.length
      await assignEventAudiences(completed, settings, emit)
      if (calls.length !== count) throw new Error("Accepted audiences were regenerated.")
      checks.push("accepted replay uses zero calls")
      const invalid = structuredClone(completed)
      invalid.plan.majorEvents[0]!.visibleToActorIds = ["foreign"]
      let invalidRejected = false
      try { await assignEventAudiences(invalid, settings, emit) } catch { invalidRejected = true }
      if (!invalidRejected || calls.length !== count) throw new Error("Invalid persisted grants were reused or triggered inference.")
      checks.push("foreign persisted grants fail before inference")
      const revised = structuredClone(saved)
      revised.scenario.controls.fastMode = false
      revised.plan!.majorEvents[3]!.status = "pending"
      delete revised.plan!.majorEvents[3]!.visibleToActorIds
      revised.plan!.majorEvents[3]!.summary = "진행자가 민아, 준서, 다현 모두에게 공개적으로 새 회의실을 공지한다."
      await assignEventAudiences(revised, settings, emit, state => store.writeState(state, lease))
      if (calls.length !== count + 1) throw new Error("Targeted retry repeated accepted siblings or required unexpected repair.")
      const resumed = await store.readState(run.id)
      if (resumed?.plan?.majorEvents[3]?.visibleToActorIds?.length !== 3) throw new Error("Corrected event was not accepted.")
      checks.push("corrected unit alone retries and persists")
    })
  } catch (error) { failure = error instanceof Error ? error.message : "Event qualification failed." }
  finally { lease.release(); await rm(rootDir, { recursive: true, force: true }) }
  const output = resolve(process.argv[2] ?? `output/qualification/event-audience-${Date.now()}.json`)
  const report = { model: MODEL, quantization: model.quantization, loaded: model.loaded_instances,
    revision: (await Bun.$`git rev-parse HEAD`.quiet().text()).trim(), dirty: Boolean((await Bun.$`git status --porcelain`.quiet().text()).trim()),
    fixtureSha256: createHash("sha256").update(fixtureText).digest("hex"), calls, warnings, audiences, checks,
    elapsedMs: performance.now() - start, status: failure ? "failed" : "passed", failure,
    scope: "Live event assignment with canonical storage, deterministic injection checks and targeted replay; no complete simulation or browser run." }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
  console.log(JSON.stringify({ output, status: report.status, calls: calls.length, failure }))
  if (failure) process.exitCode = 1
}
await main()
