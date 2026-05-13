import type { GraphEdgeView, GraphNodeView, GraphTimelineFrame, Interaction, RunEvent } from "@simula/shared"

export function buildTimelineFrame(
  index: number,
  event: RunEvent,
  previous?: GraphTimelineFrame,
  events: RunEvent[] = [event]
): GraphTimelineFrame {
  if (event.type === "round.completed") {
    return buildRoundFrame(index, event, events)
  }

  const nodes = previous ? previous.nodes.map((node) => ({ ...node })) : []
  const edges = previous ? previous.edges.map((edge) => ({ ...edge })) : []
  const messages = previous ? [...previous.messages] : []
  const logRefs = previous ? [...previous.logRefs] : []
  const activeNodeIds: string[] = []

  if (event.type === "actors.ready") {
    mergeActors(nodes, event.actors)
    activeNodeIds.push(...event.actors.map((actor) => actor.id))
  }

  if (event.type === "interaction.recorded") {
    applyInteraction(nodes, edges, event.interaction, activeNodeIds)
    messages.push(event.interaction.content)
  }

  if (event.type === "actor.message") {
    messages.push(`${event.actorName}: ${event.content}`)
    activeNodeIds.push(event.actorId)
  }

  if (event.type === "model.message") {
    messages.push(`${event.role}: ${event.content}`)
    if (event.role === "actor") {
      const actorId = actorIdForModelMessage(nodes, event.content)
      if (actorId) {
        activeNodeIds.push(actorId)
      }
    }
  }

  if (event.type === "log") {
    logRefs.push(event.message)
  }

  return {
    index,
    timestamp: event.timestamp,
    nodes,
    edges,
    activeNodeIds: [...new Set(activeNodeIds)],
    messages: messages.slice(-12),
    logRefs: logRefs.slice(-20),
    layoutRoundIndex: undefined,
  }
}

function buildRoundFrame(
  index: number,
  roundCompleted: Extract<RunEvent, { type: "round.completed" }>,
  events: RunEvent[]
): GraphTimelineFrame {
  const nodes: GraphNodeView[] = []
  const edges: GraphEdgeView[] = []
  const messages: string[] = []
  const logRefs: string[] = []
  const activeNodeIds: string[] = []
  const roundIndex = roundCompleted.roundIndex

  for (const event of events) {
    if (event.type === "actors.ready") {
      mergeActors(nodes, event.actors)
      continue
    }
    if (event.type === "interaction.recorded" && event.interaction.roundIndex <= roundIndex) {
      applyInteraction(nodes, edges, event.interaction, event.interaction.roundIndex === roundIndex ? activeNodeIds : [])
      messages.push(event.interaction.content)
      continue
    }
    if (event.type === "actor.message") {
      messages.push(`${event.actorName}: ${event.content}`)
      continue
    }
    if (event.type === "model.message") {
      messages.push(`${event.role}: ${event.content}`)
      continue
    }
    if (event.type === "log") {
      logRefs.push(event.message)
    }
  }

  return {
    index,
    timestamp: roundCompleted.timestamp,
    nodes,
    edges,
    activeNodeIds: [...new Set(activeNodeIds)],
    messages: messages.slice(-12),
    logRefs: logRefs.slice(-20),
    layoutRoundIndex: roundIndex,
  }
}

function mergeActors(nodes: GraphNodeView[], actors: GraphNodeView[]): void {
  const existingById = new Map(nodes.map((node) => [node.id, node]))
  for (const actor of actors) {
    const existing = existingById.get(actor.id)
    if (existing) {
      existing.label = actor.label
      existing.role = actor.role
      existing.intent = actor.intent
      continue
    }
    nodes.push({ ...actor, interactionCount: actor.interactionCount ?? 0 })
  }
}

function applyInteraction(
  nodes: GraphNodeView[],
  edges: GraphEdgeView[],
  interaction: Interaction,
  activeNodeIds: string[]
): void {
  if (interaction.decisionType === "no_action") {
    return
  }

  const source = nodes.find((node) => node.id === interaction.sourceActorId)
  if (source) {
    source.interactionCount += 1
    source.intent = interaction.intent
    activeNodeIds.push(source.id)
  }

  for (const targetId of interaction.targetActorIds) {
    if (targetId === interaction.sourceActorId) {
      continue
    }

    const target = nodes.find((node) => node.id === targetId)
    if (target) {
      target.interactionCount += 1
      activeNodeIds.push(target.id)
    }

    const edgeId = interactionEdgeId(interaction.sourceActorId, targetId)
    const edge = edges.find((item) => item.id === edgeId)
    if (edge) {
      edge.weight += 1
      edge.roundIndex = interaction.roundIndex
      edge.visibility = interaction.visibility
      edge.visibilityMix = incrementCount(edge.visibilityMix, interaction.visibility)
      edge.actionTypes = incrementCount(edge.actionTypes, interaction.actionType)
      edge.latestContent = interaction.content
      edge.latestActionType = interaction.actionType
      continue
    }
    edges.push({
      id: edgeId,
      source: interaction.sourceActorId,
      target: targetId,
      visibility: interaction.visibility,
      visibilityMix: { [interaction.visibility]: 1 },
      actionTypes: { [interaction.actionType]: 1 },
      weight: 1,
      roundIndex: interaction.roundIndex,
      latestContent: interaction.content,
      latestActionType: interaction.actionType,
    })
  }
}

function interactionEdgeId(source: string, target: string): string {
  return `${source}->${target}`
}

function incrementCount<T extends string>(
  counts: Partial<Record<T, number>> | undefined,
  key: T
): Record<T, number> {
  return {
    ...(counts ?? {}),
    [key]: (counts?.[key] ?? 0) + 1,
  } as Record<T, number>
}

function actorIdForModelMessage(nodes: GraphNodeView[], content: string): string | undefined {
  return nodes.find((node) => content.startsWith(`${node.label} `) || content.startsWith(`${node.label}:`))?.id
}
