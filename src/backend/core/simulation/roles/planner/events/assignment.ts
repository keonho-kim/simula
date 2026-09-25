/**
 * Purpose: Assign and persist each event's audience before any actor receives the event.
 * Pattern: Use case with bounded per-event recovery and serialized acceptance.
 * Usage: Invoked after actor generation and before coordinator rounds.
 * Related: src/backend/core/simulation/workflow/graph.ts, src/backend/core/simulation/roles/planner/events/audience.ts
 */
import type { LLMSettings, PlannedEvent, RunEvent, SimulationState } from "@/shared"
import { assertCompleteModelOutput, invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { injectedEventForRound } from "@/backend/core/simulation/events/injection"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { eventAudiencePrompt } from "./prompts/audience"
import { eventAudienceOptions, parseEventAudience } from "./audience"

const MAX_ATTEMPTS = 3

export async function assignEventAudiences(
  initial: SimulationState,
  settings: LLMSettings,
  emit: (event: RunEvent) => Promise<void>,
  saveState?: (state: SimulationState) => Promise<void>,
): Promise<SimulationState> {
  if (!initial.plan || !initial.actors.length) throw new Error("Event audiences require a plan and generated actors.")
  const plan = initial.plan
  const events = plan.majorEvents.map(event => ({ ...event }))
  // Validate all persisted grants before reusing them or making any new request.
  for (const event of events) {
    if (event.status !== "missed" && event.visibleToActorIds !== undefined) injectedEventForRound(1, event, initial.actors)
  }
  let acceptance = Promise.resolve()
  const assign = async (event: PlannedEvent, index: number) => {
    if (event.status === "missed" || event.visibleToActorIds !== undefined) return
    let audience: string[] | undefined
    let feedback: string | undefined
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const choices = eventAudienceOptions(initial.actors.length)
      const instruction = eventAudiencePrompt(initial, event, feedback)
      const prompt = choices ? instruction : withRolePromptGuide(instruction, {
        language: initial.scenario.language, settings, role: "planner",
      })
      const options = { taskId: `event-audience-${event.id}` }
      const result = choices
        ? await invokeExactChoiceWithMetrics(settings, "planner", "eventAudience", attempt, prompt, choices, options)
        : await invokeRoleTextWithMetrics(settings, "planner", "eventAudience", attempt, prompt, undefined, options)
      await emitModelTelemetry(initial.runId, result, emit)
      try {
        assertCompleteModelOutput(result)
        audience = parseEventAudience(result.text, initial.actors)
      } catch (error) {
        feedback = error instanceof Error ? error.message : "Invalid audience output."
        await emit({ type: "log", runId: initial.runId, timestamp: new Date().toISOString(), level: "warn",
          message: `planner.eventAudience ${event.id} attempt ${attempt}/${MAX_ATTEMPTS}: ${feedback}` })
        continue
      }
      break
    }
    const accepted: PlannedEvent = audience ? { ...event, visibleToActorIds: audience }
      : { ...event, status: "missed", visibleToActorIds: [] }
    acceptance = acceptance.then(async () => {
      events[index] = accepted
      const snapshot = { ...initial, plan: { ...plan, majorEvents: [...events] } }
      await saveState?.(snapshot)
      await emit({ type: "board.updated", runId: initial.runId, timestamp: new Date().toISOString(),
        update: { kind: "events", events: [...events] } })
      if (!audience) await emit({ type: "log", runId: initial.runId, timestamp: new Date().toISOString(), level: "warn",
        message: `planner.eventAudience ${event.id} skipped because its initial recipients remain unresolved; the event will not be injected.` })
    })
    await acceptance
  }
  if (initial.scenario.controls.fastMode) {
    // Drain every sibling before returning or throwing; no background writes after failure.
    const results = await Promise.allSettled(events.map(assign))
    const failure = results.find(result => result.status === "rejected")
    if (failure?.status === "rejected") throw failure.reason
  } else {
    for (let index = 0; index < events.length; index++) await assign(events[index]!, index)
  }
  return { ...initial, plan: { ...plan, majorEvents: events } }
}
