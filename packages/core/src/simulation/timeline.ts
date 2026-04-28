import type { GraphEdgeView, GraphNodeView, GraphTimelineFrame, Interaction, RunEvent } from "@simula/shared"

export function buildTimelineFrame(
  index: number,
  event: RunEvent,
  previous?: GraphTimelineFrame
): GraphTimelineFrame {
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
    layoutRoundIndex: event.type === "round.completed" ? event.roundIndex : undefined,
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
  const source = nodes.find((node) => node.id === interaction.sourceActorId)
  if (source) {
    source.interactionCount += 1
    source.intent = interaction.intent
    activeNodeIds.push(source.id)
  }

  for (const targetId of interaction.targetActorIds) {
    const target = nodes.find((node) => node.id === targetId)
    if (target) {
      target.interactionCount += 1
      activeNodeIds.push(target.id)
    }

    const edgeId = interactionEdgeId(interaction.sourceActorId, targetId, interaction.visibility)
    const edge = edges.find((item) => item.id === edgeId)
    if (edge) {
      edge.weight += 1
      edge.roundIndex = interaction.roundIndex
      edge.latestContent = interaction.content
      continue
    }
    edges.push({
      id: edgeId,
      source: interaction.sourceActorId,
      target: targetId,
      visibility: interaction.visibility,
      weight: 1,
      roundIndex: interaction.roundIndex,
      latestContent: interaction.content,
    })
  }
}

function interactionEdgeId(source: string, target: string, visibility: Interaction["visibility"]): string {
  return `${source}->${target}:${visibility}`
}

function actorIdForModelMessage(nodes: GraphNodeView[], content: string): string | undefined {
  return nodes.find((node) => content.startsWith(`${node.label} `) || content.startsWith(`${node.label}:`))?.id
}
