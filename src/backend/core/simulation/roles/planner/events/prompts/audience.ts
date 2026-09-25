/**
 * Purpose: Ask the Planner to assign initial visibility for one planned event.
 * Pattern: Flat context prompt builder.
 * Usage: Called per event by Planner audience assignment with validation feedback.
 * Related: src/backend/core/simulation/roles/planner/events/assignment.ts
 */
import type { PlannedEvent, SimulationState } from "@/shared"
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"

export function eventAudiencePrompt(state: SimulationState, event: PlannedEvent, feedback?: string): string {
  return `Assign initial recipients for ONE planned event. Do not generate or rewrite the event.
The roster contains numbered actors. Names mentioned in an event are not automatically recipients.
A private message is visible to its sender and intended recipient only. A private discovery is visible only to its discoverer.
A group conversation is visible only to that group. A public announcement or shared observable change is public.
If one actor discovers a fact without communicating it, initially only that actor knows it.
Respect confirmed information rules and initial source grants. Knowing a fact is not permission to broadcast it.
Do not invent a public disclosure to resolve ambiguity. Later accepted actor speech can disclose information separately.
Return 0 when the event is explicitly public.
Return actor numbers separated by commas for a known subset; a private message includes its sender and recipient.
Return ? if the supplied context cannot establish recipients; never guess everyone.
Return only one complete choice, without explanation, JSON or markup.

${renderPromptBlocks({
    SCENARIO: { informationRules: state.scenario.world?.informationFlow ?? [],
      setting: state.scenario.world?.opening.setting },
    ACTOR: state.actors.map((actor, index) => ({ number: index + 1, name: actor.name, role: actor.role })),
    SOURCE: state.actors.map(actor => ({ actorId: actor.id, knownFacts: actor.knownSourceFacts ?? [] })),
    REVIEW_TARGET: { id: event.id, title: event.title, summary: event.summary },
    FEEDBACK: feedback,
  })}`
}
