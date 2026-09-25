/**
 * Purpose: Qualify world source-access isolation and actor handoff against actual local Ornith.
 * Pattern: Bounded live module qualification.
 * Usage: bun scripts/qualify-world-access.ts; optional first argument selects a new JSON result path.
 * Related: src/backend/core/story-builder/world/graph.ts, sample-input-items/world-access.json
 */
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { z } from "zod"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { specificationSchema } from "@/shared/scenario-builder-schema"
import { prepareWorldStory } from "@/backend/core/story-builder/world/graph"
import { scenarioFromWorld } from "@/backend/core/story-builder/world/handoff"
import { preparedWorldActors } from "@/backend/core/simulation/roles/generator/prepared-world"
import { createActorContext } from "@/backend/core/simulation/roles/actor/context"
import { createActorGraphState } from "@/backend/core/simulation/roles/actor/state"
import { actorPrompts } from "@/backend/core/simulation/roles/actor/prompts"
import { emptyCoordinatorTrace } from "@/backend/core/simulation/roles/coordinator/state"
import { applyInteractionContext } from "@/backend/core/simulation/actors/memory"
import { createGenerationInvocation } from "@/backend/integrations/llm/generation"
import { runWithModelExecution } from "@/backend/integrations/llm/execution-context"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { RunStore } from "@/backend/storage/runs/run-store"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import type { AcceptedGenerationTask, GenerationDependencies } from "@/backend/core/generation/tasks"

const MODEL = "ornith-1.5-35b-a3b"
const ENDPOINT = "http://127.0.0.1:1234"
const MAX_CALLS = 50
const DEADLINE_MS = 600_000
const inputPath = resolve(import.meta.dir, "../sample-input-items/world-access.json")

async function main() {
  if (process.env.SIMULA_TEST_MODEL === "1") throw new Error("Disable mock inference for this qualification.")
  const fixtureText = await Bun.file(inputPath).text()
  const fixture = z.object({ publicFact: z.string(), restrictedFact: z.string(), restrictedMarker: z.string(),
    participants: z.array(z.string()).length(2) }).strict().parse(JSON.parse(fixtureText))
  const response = await fetch(`${ENDPOINT}/api/v1/models`, { signal: AbortSignal.timeout(5000) })
  const catalog = z.object({ models: z.array(z.object({ key: z.string(), quantization: z.unknown().optional(),
    loaded_instances: z.array(z.object({ id: z.string(), config: z.unknown() })) })) }).parse(await response.json())
  const model = catalog.models.find(model => model.key === MODEL)
  if (!response.ok || !model?.loaded_instances.some(instance => instance.id === MODEL)) throw new Error(`Load ${MODEL} in LM Studio.`)
  const documentId = "22222222-2222-4222-8222-222222222222"
  const publicId = `${documentId}:text:1`, privateId = `${documentId}:text:2`
  const facet = { summary: "투자 조건을 검토한다.", assumptions: [], evidenceIds: [publicId] }
  const rule = { entries: ["서로 알고 있는 정보만 공유한다."], assumptions: [], evidenceIds: [publicId] }
  const source = specificationSchema.parse({ id: "11111111-1111-4111-8111-111111111111", version: 1, status: "confirmed",
    documentSetId: documentId, documentRevision: 1, language: "ko",
    situation: { title: "투자 검토", purpose: "투자 조건을 논의한다.", decision: "승인 또는 보류를 판단한다.",
      setting: "금요일 회의실", assumptions: [], evidenceIds: [publicId] },
    facets: { goals: facet, constraints: facet, tensions: facet },
    participants: fixture.participants.map((name, index) => ({ id: `participant-${index + 1}`, name,
      personality: "근거를 확인하고 신중히 판단한다.", authority: index ? "재무 검토를 담당한다." : "기술 검토를 담당한다.",
      goal: "실행 가능한 계획을 검토한다.", nameLocked: true, personalityLocked: true, evidenceIds: [publicId] })),
    rules: { information: rule, actions: rule, termination: { ...rule, entries: ["결정과 미해결 조건을 기록한다."] }, variation: rule },
    sourceFacts: [{ id: "fact-1", text: fixture.publicFact, evidenceIds: [publicId], audience: { kind: "public" } },
      { id: "fact-2", text: fixture.restrictedFact, evidenceIds: [privateId], audience: { kind: "participants", participantIds: ["participant-2"] } }],
    sourceEvidenceIds: [publicId, privateId], issues: [],
  })
  const settings = defaultSettings()
  settings.concurrency = 1
  settings.providers.lmstudio = { baseUrl: `${ENDPOINT}/v1`, apiKey: "lm-studio", streamUsage: true }
  settings.roles.storyBuilder = { provider: "lmstudio", model: MODEL, temperature: 0, maxTokens: 768,
    timeoutSeconds: 60, extraBody: { reasoning_effort: "none" } }
  const signal = AbortSignal.timeout(DEADLINE_MS)
  const generation = createGenerationInvocation(settings, signal)
  const accepted = new Map<string, AcceptedGenerationTask>()
  const calls: { task: string; attempt: number; restrictedInput: boolean; durationMs?: number }[] = []
  const dependencies: GenerationDependencies = { ...generation, signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, structuredClone(task)) }, emit: async () => {},
    invoke: async call => {
      if (calls.length >= MAX_CALLS) throw new Error("World qualification call budget exhausted.")
      const restrictedInput = call.prompt.includes(fixture.restrictedMarker)
      const privateTask = call.id === "concern-participant-2"
      if (restrictedInput && !privateTask) throw new Error(`Restricted source reached public or foreign task ${call.id}.`)
      const observed: typeof calls[number] = { task: call.id, attempt: call.attempt, restrictedInput }
      calls.push(observed)
      console.log(JSON.stringify(observed))
      const output = await generation.invoke(call)
      observed.durationMs = output.metrics?.durationMs
      return output
    },
  }
  let failure: string | undefined
  const start = performance.now()
  try {
    await runWithModelExecution({ owner: "world-access-qualification", admission: new ModelAdmission({ concurrency: 1 }), signal }, async () => {
      const world = await prepareWorldStory(crypto.randomUUID(), source, false, dependencies)
      const scenario = scenarioFromWorld(world, source, { maxRound: 1 })
      const actors = preparedWorldActors(world, {})
      if (scenario.text.includes(fixture.restrictedMarker)) throw new Error("Private source leaked through scenario handoff.")
      const prompt = (index: number, cast = actors) => actorPrompts.thought({ ...createActorGraphState(), ...createActorContext({
        runId: "world-access", scenario, plannerDigest: scenario.text, actor: cast[index]!, actors: cast,
        event: { id: "event", title: "검토", summary: "투자 검토를 시작한다.", status: "active", participantIds: [] },
        roundDigest: { roundIndex: 1, preRound: { elapsedTime: "0", content: "검토를 시작한다." } },
        roundIndex: 1, coordinatorTrace: emptyCoordinatorTrace(),
      }) }, {})
      if (prompt(0).includes(fixture.restrictedMarker) || !prompt(1).includes(fixture.restrictedMarker)) throw new Error("Actor initial source entitlement is incorrect.")
      const disclosed = applyInteractionContext(actors, { id: "disclosure", roundIndex: 1, sourceActorId: actors[1]!.id,
        targetActorIds: [actors[0]!.id], actionType: "정보 공유", content: fixture.restrictedFact, eventId: "event",
        visibility: "private", decisionType: "action", intent: "논의", expectation: "확인" })
      if (!prompt(0, disclosed).includes(fixture.restrictedMarker) || prompt(0).includes(fixture.restrictedMarker)) throw new Error("Accepted disclosure did not preserve causal knowledge.")
      const count = calls.length
      await prepareWorldStory(world.id, source, false, dependencies)
      if (calls.length !== count) throw new Error("Accepted world tasks were regenerated.")
      const wrongGrant = structuredClone(world)
      wrongGrant.participants[0]!.knownSourceFacts = structuredClone(world.participants[1]!.knownSourceFacts)
      let rejected = false
      try { scenarioFromWorld(wrongGrant, source, {}) } catch { rejected = true }
      if (!rejected) throw new Error("A modified world was allowed to escalate source access.")
      const rootDir = await mkdtemp(join(tmpdir(), "simula-world-access-"))
      try {
        const store = new RunStore({ rootDir })
        const run = await store.createRun(scenario)
        const lease = store.execution(run.id).claim()
        if (!lease) throw new Error("Qualification run could not acquire storage ownership.")
        try { await store.writeState({ ...initialSimulationState(run.id, scenario), actors }, lease) }
        finally { lease.release() }
        const reopened = await new RunStore({ rootDir }).readState(run.id)
        if (!reopened || JSON.stringify(reopened.actors.map(actor => actor.knownSourceFacts)) !== JSON.stringify(actors.map(actor => actor.knownSourceFacts))) {
          throw new Error("Reopened actor knowledge differs from the confirmed grants.")
        }
      } finally { await rm(rootDir, { recursive: true, force: true }) }
    })
  } catch (error) { failure = error instanceof Error ? error.message : "World qualification failed." }
  const output = resolve(process.argv[2] ?? `output/qualification/world-access-${Date.now()}.json`)
  const report = { model: MODEL, quantization: model.quantization, loaded: model.loaded_instances,
    revision: (await Bun.$`git rev-parse HEAD`.quiet().text()).trim(), dirty: Boolean((await Bun.$`git status --porcelain`.quiet().text()).trim()),
    fixtureSha256: createHash("sha256").update(fixtureText).digest("hex"), calls, elapsedMs: performance.now() - start,
    status: failure ? "failed" : "passed", failure, scope: "Confirmed synthetic scenario through real world preparation, deterministic actor handoff/disclosure and canonical run-state reopen; no Planner or simulation model run." }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
  console.log(JSON.stringify({ output, status: report.status, calls: calls.length, failure }))
  if (failure) process.exitCode = 1
}
await main()
