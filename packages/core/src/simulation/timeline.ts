import type { GraphEdgeView, GraphNodeView, GraphTimelineFrame, RunEvent } from "@simula/shared"

const STAGE_IDS = ["planner", "generator", "coordinator", "observer", "finalization"]

export function initialGraphNodes(): GraphNodeView[] {
  return STAGE_IDS.map((id) => ({
    id,
    label: stageLabel(id),
    kind: "stage",
    status: "pending",
  }))
}

export function initialGraphEdges(): GraphEdgeView[] {
  return [
    { id: "planner-generator", source: "planner", target: "generator" },
    { id: "generator-coordinator", source: "generator", target: "coordinator" },
    { id: "coordinator-observer", source: "coordinator", target: "observer" },
    { id: "observer-finalization", source: "observer", target: "finalization" },
  ]
}

export function buildTimelineFrame(
  index: number,
  event: RunEvent,
  previous?: GraphTimelineFrame
): GraphTimelineFrame {
  const nodes = previous ? [...previous.nodes] : initialGraphNodes()
  const edges = previous ? [...previous.edges] : initialGraphEdges()
  const messages = previous ? [...previous.messages] : []
  const logRefs = previous ? [...previous.logRefs] : []
  const activeNodeIds: string[] = []

  if (event.type === "node.started" || event.type === "node.completed" || event.type === "node.failed") {
    const node = nodes.find((item) => item.id === event.nodeId)
    if (node) {
      node.status =
        event.type === "node.started"
          ? "running"
          : event.type === "node.completed"
            ? "completed"
            : "failed"
      activeNodeIds.push(event.nodeId)
    }
  }

  if (event.type === "actor.message") {
    if (!nodes.some((node) => node.id === event.actorId)) {
      nodes.push({
        id: event.actorId,
        label: event.actorName,
        kind: "actor",
        status: "completed",
      })
      edges.push({
        id: `coordinator-${event.actorId}`,
        source: "coordinator",
        target: event.actorId,
        label: "speaks",
      })
    }
    messages.push(`${event.actorName}: ${event.content}`)
    activeNodeIds.push(event.actorId, "coordinator")
  }

  if (event.type === "model.message") {
    messages.push(`${event.role}: ${event.content}`)
  }

  if (event.type === "log") {
    logRefs.push(event.message)
  }

  return {
    index,
    timestamp: event.timestamp,
    nodes,
    edges,
    activeNodeIds,
    messages: messages.slice(-12),
    logRefs: logRefs.slice(-20),
  }
}

function stageLabel(id: string): string {
  if (id === "generator") return "Generator"
  if (id === "coordinator") return "Coordinator"
  if (id === "observer") return "Observer"
  return id.slice(0, 1).toUpperCase() + id.slice(1)
}
