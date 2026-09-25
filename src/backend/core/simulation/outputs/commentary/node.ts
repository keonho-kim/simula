/**
 * Purpose: Build one commentary node from accepted text fields and a finite finding count.
 * Pattern: Sequential field workflow with bounded retries.
 * Usage: Called by the bottom-up report commentary frontier.
 * Related: src/backend/core/simulation/outputs/commentary/workflow.ts, src/shared/report-commentary.ts
 */
import { z } from "zod"
import type { LLMSettings, PromptLanguage, ReportCommentaryNode, RunEvent } from "@/shared"
import { assertCompleteModelOutput, invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { commentarySummary } from "./prompts/summary"
import { commentaryFindingCount } from "./prompts/finding-count"
import { commentaryFinding } from "./prompts/finding"
import { commentaryConclusion } from "./prompts/conclusion"

const ATTEMPTS = 3
const MAX_COMMENTARY_PROSE_CHARS = 32_000
const summarySchema = z.string().trim().min(1).max(MAX_COMMENTARY_PROSE_CHARS)
const findingSchema = z.string().trim().min(1).max(MAX_COMMENTARY_PROSE_CHARS)
const conclusionSchema = z.string().trim().min(1).max(MAX_COMMENTARY_PROSE_CHARS)
const findingCountSchema = z.number().int().min(1).max(4)
export const commentaryReadySchema = z.object({ summary: summarySchema,
  findingCount: findingCountSchema.optional(), findings: z.array(findingSchema).min(1).max(4),
  conclusion: conclusionSchema, evidenceIds: z.array(z.string()).min(1).max(12) })

export interface CommentaryTask { id: string; level: number; children: string[]; evidenceIds: string[]; text: string }
interface NodeInput {
  task: CommentaryTask
  previous?: ReportCommentaryNode
  context: string
  language: PromptLanguage | undefined
  overall: boolean
  settings: LLMSettings
  runId: string
  emit: (event: RunEvent) => Promise<void>
  isCanceled: () => boolean
}

class FieldFailure extends Error {
  constructor(message: string, readonly providerFailed: boolean) { super(message) }
}

export async function buildCommentaryNode(input: NodeInput): Promise<ReportCommentaryNode> {
  const { task, previous, context, language, overall, settings, runId, emit, isCanceled } = input
  const base = { id: task.id, level: task.level, children: task.children, evidenceIds: task.evidenceIds }
  if (!task.evidenceIds.length) return { ...base, status: "failed", issue: "No validated supporting commentary is available." }
  const accepted = previous && previous.evidenceIds.join("\0") === task.evidenceIds.join("\0") ? previous : undefined
  let summary = summarySchema.safeParse(accepted?.summary).success ? accepted?.summary : undefined
  let findingCount = findingCountSchema.safeParse(accepted?.findingCount).success ? accepted?.findingCount : undefined
  const findings = accepted?.findings?.filter(value => findingSchema.safeParse(value).success) ?? []
  let conclusion = conclusionSchema.safeParse(accepted?.conclusion).success ? accepted?.conclusion : undefined
  const checkCanceled = () => { if (isCanceled()) throw new Error("Run canceled.") }
  async function requestField<T>(name: string, promptFor: (feedback: string) => string, parse: (text: string) => T): Promise<T> {
    let feedback = ""
    let providerFailed = false
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      checkCanceled()
      const prompt = withRolePromptGuide(promptFor(feedback), { language, settings, role: "observer" })
      let result
      try {
        result = name === "finding-count"
          ? await invokeExactChoiceWithMetrics(settings, "observer", "reportCommentary", attempt, prompt, ["1", "2", "3", "4"])
          : await invokeRoleTextWithMetrics(settings, "observer", "reportCommentary", attempt, prompt)
      } catch {
        checkCanceled()
        providerFailed = true
        feedback = "Model request failed. Retry this field."
        continue
      }
      checkCanceled()
      providerFailed = false
      await emitModelTelemetry(runId, result, emit)
      try {
        assertCompleteModelOutput(result)
        return parse(result.text)
      } catch (error) {
        feedback = error instanceof Error ? error.message.slice(0, 700) : "Return one complete answer."
      }
    }
    throw new FieldFailure(`${name}: ${feedback}`, providerFailed)
  }
  try {
    const completedSummary = summary ?? await requestField("summary", feedback => commentarySummary(task, context, language, feedback),
      text => summarySchema.parse(text.trim()))
    summary = completedSummary
    const completedCount = findingCount ?? await requestField("finding-count", feedback => commentaryFindingCount(task, context, language, completedSummary, feedback),
      text => findingCountSchema.parse(/^\d$/.test(text.trim()) ? Number(text.trim()) : NaN))
    findingCount = completedCount
    findings.splice(completedCount)
    while (findings.length < completedCount) {
      findings.push(await requestField(`finding-${findings.length + 1}`,
        feedback => commentaryFinding(task, context, language, completedSummary, findings, feedback),
        text => findingSchema.parse(text.trim())))
    }
    conclusion ??= await requestField("conclusion", feedback => commentaryConclusion(task, context, language, completedSummary, findings, overall, feedback),
      text => conclusionSchema.parse(text.trim()))
    const content = commentaryReadySchema.parse({ summary, findingCount, findings, conclusion, evidenceIds: task.evidenceIds })
    return { ...base, status: "ready", ...content }
  } catch (error) {
    if (!(error instanceof FieldFailure)) throw error
    await emit({ type: "log", runId, timestamp: new Date().toISOString(), level: "warn",
      message: `observer.reportCommentary ${task.id}: unavailable after ${ATTEMPTS} attempts. ${error.message}` })
    return { ...base, status: "failed", summary, findingCount, findings, conclusion,
      issue: error.providerFailed ? "Provider unavailable after 3 attempts." : "Commentary generation failed after 3 attempts." }
  }
}
