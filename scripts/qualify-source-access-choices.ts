/**
 * Purpose: Qualify per-fact indexed source audiences against real local Ornith inference.
 * Pattern: Bounded live module qualification.
 * Usage: bun scripts/qualify-source-access-choices.ts; optional first argument selects a new result file.
 * Related: src/backend/core/scenario-builder/source-access.ts, sample-input-items/source-access-choices.json
 */
import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { z } from "zod"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { createGenerationTasks, type AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { buildSourceAccess, readSourceFacts, sourceAudienceTaskId } from "@/backend/core/scenario-builder/source-access"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { createGenerationInvocation } from "@/backend/integrations/llm/generation"
import { runWithModelExecution } from "@/backend/integrations/llm/execution-context"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { digestSchema } from "@/shared/scenario-builder-schema"
import type { ModelMetrics } from "@/shared"

const MODEL = "ornith-1.5-35b-a3b"
const ENDPOINT = "http://127.0.0.1:1234"
const MAX_CALLS = 12
const inputPath = resolve(import.meta.dir, "../sample-input-items/source-access-choices.json")

async function main() {
  if (process.env.SIMULA_TEST_MODEL === "1") throw new Error("Disable mock inference for live qualification.")
  const fixtureText = await Bun.file(inputPath).text()
  const fixture = z.object({ restricted: z.string(), public: z.string(), participants: z.array(z.string()).length(2), informationRule: z.string() })
    .parse(JSON.parse(fixtureText))
  const response = await fetch(`${ENDPOINT}/api/v1/models`, { signal: AbortSignal.timeout(5000) })
  const catalog = z.object({ models: z.array(z.object({ key: z.string(), quantization: z.unknown().optional(),
    loaded_instances: z.array(z.object({ id: z.string(), config: z.unknown() })) })) }).parse(await response.json())
  const model = catalog.models.find(entry => entry.key === MODEL)
  if (!response.ok || !model?.loaded_instances.some(instance => instance.id === MODEL)) throw new Error(`Load ${MODEL} in local LM Studio.`)
  const settings = defaultSettings()
  settings.concurrency = 1
  settings.providers.lmstudio = { baseUrl: `${ENDPOINT}/v1`, apiKey: "lm-studio", streamUsage: true }
  settings.roles.storyBuilder = { provider: "lmstudio", model: MODEL, temperature: 0, maxTokens: 256,
    timeoutSeconds: 60, extraBody: { reasoning_effort: "none" } }
  const signal = AbortSignal.timeout(300_000)
  const generation = createGenerationInvocation(settings, signal)
  const accepted = new Map<string, AcceptedGenerationTask>()
  const calls: { task: string; attempt: number; metrics?: ModelMetrics }[] = []
  const evidence = "11111111-1111-4111-8111-111111111111:text:1"
  const digest = digestSchema.parse({ summary: "예산과 회의 일정을 검토한다.", claims: [
    { text: fixture.restricted, evidenceIds: [evidence] }, { text: fixture.public, evidenceIds: [evidence] }], gaps: [] })
  const participants = fixture.participants.map((name, index) => ({ id: `participant-${index + 1}`, name,
    authority: index ? "예산 검토" : "기술 검토", goal: "결정 준비", personality: "신중함", evidenceIds: [evidence],
    nameLocked: true, personalityLocked: false }))
  const save = (id: string, value: unknown) => accepted.set(id, { id, value, fingerprint: "fixture", attempt: 0 })
  save("digest", digest)
  for (const person of participants) save(person.id, person)
  save("rule-information", { entries: [fixture.informationRule], assumptions: [], evidenceIds: [evidence] })
  const request = parseBuilderRequest({ documentSetId: "11111111-1111-4111-8111-111111111111", documentRevision: 1,
    language: "ko", fastMode: false, participants: fixture.participants.map(name => ({ name })) })
  const tasks = createGenerationTasks(request, { ...generation, signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, structuredClone(task)) }, emit: async () => {},
    invoke: async call => {
      if (calls.length >= MAX_CALLS) throw new Error("Qualification call budget exhausted.")
      const observed: typeof calls[number] = { task: call.id, attempt: call.attempt }
      calls.push(observed)
      console.log(JSON.stringify(observed))
      const result = await generation.invoke(call)
      observed.metrics = result.metrics
      return result
    } })
  const start = performance.now()
  let failure: string | undefined
  const checks: string[] = []
  let audiences: unknown[] = []
  try {
    await runWithModelExecution({ owner: "source-access-qualification", admission: new ModelAdmission({ concurrency: 1 }), signal }, async () => {
      const refs = participants.map(person => person.id)
      const accessRef = await buildSourceAccess(tasks, "digest", refs, "rule-information")
      const facts = await readSourceFacts(tasks, "digest", refs, accessRef)
      audiences = facts.map(fact => fact.audience)
      if (facts[0]?.audience.kind !== "participants" || facts[0].audience.participantIds.join() !== "participant-2"
        || facts[1]?.audience.kind !== "public") throw new Error("Ornith did not preserve the private/public access distinction.")
      checks.push("indexed private/public choices resolved to exact actor IDs")
      const count = calls.length
      await buildSourceAccess(tasks, "digest", refs, "rule-information")
      if (calls.length !== count) throw new Error("Accepted facts were regenerated on replay.")
      checks.push("accepted replay uses zero model calls")
      tasks.repairs.set(sourceAudienceTaskId("fact-1"), "Reconsider fact-1 using the confirmed information rule.")
      await buildSourceAccess(tasks, "digest", refs, "rule-information")
      if (calls.length !== count + 1) throw new Error("Targeted repair regenerated the other fact or required more than one attempt.")
      const repaired = await readSourceFacts(tasks, "digest", refs, accessRef)
      if (repaired[0]?.audience.kind !== "participants" || repaired[0].audience.participantIds.join() !== "participant-2") {
        throw new Error("Targeted repair changed the permitted recipient.")
      }
      checks.push("one-fact repair preserves accepted sibling")
    })
  } catch (error) { failure = error instanceof Error ? error.message : "Source choice qualification failed." }
  const output = resolve(process.argv[2] ?? `output/qualification/source-access-choices-${Date.now()}.json`)
  const report = { model: MODEL, quantization: model.quantization, loaded: model.loaded_instances,
    revision: (await Bun.$`git rev-parse HEAD`.quiet().text()).trim(), dirty: Boolean((await Bun.$`git status --porcelain`.quiet().text()).trim()),
    fixtureSha256: createHash("sha256").update(fixtureText).digest("hex"), calls, audiences, checks,
    elapsedMs: performance.now() - start, status: failure ? "failed" : "passed", failure,
    scope: "ScenarioBuilder source audience choices only; no complete builder, world or browser test." }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
  console.log(JSON.stringify({ output, status: report.status, calls: calls.length, failure }))
  if (failure) process.exitCode = 1
}
await main()
