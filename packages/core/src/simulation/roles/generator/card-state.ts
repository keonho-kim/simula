import type { ActorCardStep, ActorRosterEntry, LLMSettings, RunEvent, ScenarioInput } from "@simula/shared"
import type { ActorCard } from "./state"

export interface ActorCardGraphState {
  runId: string
  scenario: ScenarioInput
  settings: LLMSettings
  actorIndex: number
  assignedName: string
  roleSeed: string
  fullRoster: ActorRosterEntry[]
  plannerDigest: string
  card: Partial<ActorCard>
  retryCounts: Record<ActorCardStep, number>
  emit: (event: RunEvent) => Promise<void>
}

export const ACTOR_CARD_STEPS: ActorCardStep[] = [
  "role",
  "backgroundHistory",
  "personality",
  "preference",
]

export function initialActorCardState(
  input: Omit<ActorCardGraphState, "card" | "retryCounts">
): ActorCardGraphState {
  return {
    ...input,
    card: {},
    retryCounts: {
      role: 0,
      backgroundHistory: 0,
      personality: 0,
      preference: 0,
    },
  }
}

export function completeActorCard(state: ActorCardGraphState): ActorCard {
  return {
    role: state.card.role ?? state.roleSeed,
    name: state.assignedName,
    backgroundHistory: state.card.backgroundHistory ?? "No background history generated.",
    personality: state.card.personality ?? "Pragmatic under pressure.",
    preference: state.card.preference ?? "Reduce uncertainty while protecting their own position.",
  }
}
