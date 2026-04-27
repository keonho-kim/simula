import type {
  ActionVisibility,
  ActorDecision,
  ActorState,
  Interaction,
  PlannedEvent,
  RoundDigest,
} from "@simula/shared"
import { applyInteractionContext, applyPreRoundDigestContext, contextUsedByActor } from "../../context"

const ROUND_VISIBILITY: ActionVisibility[] = ["public", "semi-public", "private", "solitary"]

export function buildCoordinatorInteractions(
  events: PlannedEvent[],
  actors: ActorState[],
  trace: { action: string; intent: string }
): { actors: ActorState[]; interactions: Interaction[]; roundDigests: RoundDigest[] } {
  let nextActors = actors
  const interactions: Interaction[] = []
  const roundDigests: RoundDigest[] = []
  const rounds = Math.min(3, Math.max(1, events.length))

  for (let roundIndex = 1; roundIndex <= rounds; roundIndex += 1) {
    const preRoundDigest = buildPreRoundDigest(roundIndex, events[roundIndex - 2])
    roundDigests.push(preRoundDigest)
    nextActors = applyPreRoundDigestContext(nextActors, preRoundDigest)

    const event = events[roundIndex - 1]
    const actor = nextActors[(roundIndex - 1) % nextActors.length]
    const target = nextActors[roundIndex % nextActors.length]
    if (!event || !actor || !target) {
      continue
    }

    const decision = selectActorDecision(actor, target, roundIndex, trace)
    event.status = "completed"
    const updatedActor = {
      ...actor,
      intent: decision.intent,
      relationships: {
        ...actor.relationships,
        [target.name]: `engaged through a ${decision.visibility} interaction`,
      },
    }

    nextActors = nextActors.map((item) => (item.id === actor.id ? updatedActor : item))
    const interaction = {
      id: `round-${roundIndex}-${actor.id}`,
      roundIndex,
      sourceActorId: actor.id,
      targetActorIds: decision.targetActorIds,
      actionType: decision.actionId ?? decision.decisionType,
      content: interactionContent(updatedActor, target, event, decision),
      eventId: event.id,
      visibility: decision.visibility,
      decisionType: decision.decisionType,
      intent: decision.intent,
      expectation: decision.expectation,
    } satisfies Interaction
    interactions.push(interaction)
    nextActors = applyInteractionContext(nextActors, interaction)
  }

  return { actors: nextActors, interactions, roundDigests }
}

function buildPreRoundDigest(roundIndex: number, previousEvent?: PlannedEvent): RoundDigest {
  const elapsedTime = roundIndex === 1 ? "Opening moment" : `After ${previousEvent?.title ?? "the previous event"}`
  const content =
    roundIndex === 1
      ? "The situation is now visible to every actor."
      : `${previousEvent?.summary ?? "The previous event changed the shared situation."}`
  return {
    roundIndex,
    preRound: {
      elapsedTime,
      content,
    },
    afterRound: {
      content: "",
    },
  }
}

function selectActorDecision(
  actor: ActorState,
  target: ActorState,
  roundIndex: number,
  trace: { action: string; intent: string }
): ActorDecision {
  const visibility = ROUND_VISIBILITY[(roundIndex - 1) % ROUND_VISIBILITY.length] ?? "public"
  const action = actor.actions.find((item) => item.visibility === visibility)
  if (!action) {
    return {
      actorId: actor.id,
      decisionType: "no_action",
      visibility: "solitary",
      targetActorIds: [],
      intent: `Hold position while considering ${trace.intent.toLowerCase()}.`,
      expectation: "Waiting preserves optionality for a later turn.",
      contextUsed: contextUsedByActor(actor),
    }
  }

  return {
    actorId: actor.id,
    actionId: action.id,
    decisionType: "action",
    visibility,
    targetActorIds: visibility === "solitary" ? [] : [target.id],
    intent: action.intentHint,
    expectation: action.expectedOutcome,
    contextUsed: contextUsedByActor(actor),
  }
}

function interactionContent(
  actor: ActorState,
  target: ActorState,
  event: PlannedEvent,
  decision: ActorDecision
): string {
  if (decision.decisionType === "no_action") {
    return `${actor.name} held back during "${event.title}".`
  }
  const targetText = decision.targetActorIds.length > 0 ? ` with ${target.name}` : ""
  return `${actor.name} advanced "${event.title}"${targetText} through a ${decision.visibility} action.`
}
