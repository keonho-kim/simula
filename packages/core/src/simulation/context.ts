import type { ActorContextMemory, ActorState, Interaction, RoundDigest } from "@simula/shared"

export function emptyActorContext(): ActorContextMemory {
  return {
    public: [],
    semiPublic: {},
    private: {},
    solitary: [],
  }
}

export function contextUsedByActor(actor: ActorState): string[] {
  return [
    ...actor.context.public,
    ...Object.values(actor.context.semiPublic).flat(),
    ...Object.values(actor.context.private).flat(),
    ...actor.context.solitary,
  ].slice(-12)
}

export function applyInteractionContext(actors: ActorState[], interaction: Interaction): ActorState[] {
  const entry = contextEntry(interaction)
  return actors.map((actor) => {
    const receivesContext = shouldReceiveContext(actor.id, interaction)
    if (!receivesContext) {
      return actor
    }
    return {
      ...actor,
      context: appendContext(actor.context, interaction, entry),
      memory: [...actor.memory, entry].slice(-12),
    }
  })
}

export function applyPreRoundDigestContext(actors: ActorState[], digest: RoundDigest): ActorState[] {
  const entry = `pre-round ${digest.roundIndex}: ${digest.preRound.elapsedTime}. ${digest.preRound.content}`
  return actors.map((actor) => ({
    ...actor,
    context: {
      ...actor.context,
      public: [...actor.context.public, entry],
    },
    memory: [...actor.memory, entry].slice(-12),
  }))
}

function shouldReceiveContext(actorId: string, interaction: Interaction): boolean {
  if (interaction.visibility === "public") {
    return true
  }
  if (interaction.visibility === "semi-public" || interaction.visibility === "private") {
    return actorId === interaction.sourceActorId || interaction.targetActorIds.includes(actorId)
  }
  return actorId === interaction.sourceActorId
}

function appendContext(
  context: ActorContextMemory,
  interaction: Interaction,
  entry: string
): ActorContextMemory {
  if (interaction.visibility === "public") {
    return { ...context, public: [...context.public, entry] }
  }
  if (interaction.visibility === "semi-public") {
    return {
      ...context,
      semiPublic: {
        ...context.semiPublic,
        [interaction.id]: [...(context.semiPublic[interaction.id] ?? []), entry],
      },
    }
  }
  if (interaction.visibility === "private") {
    return {
      ...context,
      private: {
        ...context.private,
        [interaction.id]: [...(context.private[interaction.id] ?? []), entry],
      },
    }
  }
  return { ...context, solitary: [...context.solitary, entry] }
}

function contextEntry(interaction: Interaction): string {
  return `${interaction.visibility}: ${interaction.content} Intent: ${interaction.intent} Expectation: ${interaction.expectation}`
}
