import { useMemo } from "react"
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react"
import type { GraphTimelineFrame, GraphNodeView } from "@simula/shared"

interface GraphViewProps {
  frame?: GraphTimelineFrame
}

export function GraphView({ frame }: GraphViewProps) {
  const activeNodeIds = useMemo(() => new Set(frame?.activeNodeIds ?? []), [frame])
  const nodes = useMemo<Node[]>(() => {
    return (frame?.nodes ?? []).map((node, index) => ({
      id: node.id,
      position: {
        x: 60 + (index % 4) * 230,
        y: 70 + Math.floor(index / 4) * 145,
      },
      data: { label: `${node.label} · ${node.status}` },
      type: "default",
      style: nodeStyle(node, activeNodeIds.has(node.id)),
    }))
  }, [activeNodeIds, frame])
  const edges = useMemo<Edge[]>(() => {
    return (frame?.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      style: { stroke: "var(--muted-foreground)", strokeWidth: 1.2 },
      labelStyle: { fill: "var(--muted-foreground)", fontSize: 11 },
    }))
  }, [frame])

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-lg bg-[oklch(0.992_0.006_98)] ring-1 ring-border/60">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.35} maxZoom={1.5}>
        <Background color="oklch(0.86 0.012 250)" gap={22} size={1} />
        <Controls position="bottom-right" />
      </ReactFlow>
      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[320px] text-center">
            <p className="text-sm font-medium">No graph frames yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Create and execute a run to watch the simulation topology emerge.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function nodeStyle(node: GraphNodeView, active: boolean): React.CSSProperties {
  const backgroundByKind: Record<GraphNodeView["kind"], string> = {
    stage: "oklch(0.985 0.012 94)",
    actor: "oklch(0.982 0.018 222)",
    event: "oklch(0.984 0.018 145)",
    artifact: "oklch(0.986 0.018 52)",
  }
  const borderByStatus: Record<GraphNodeView["status"], string> = {
    pending: "var(--border)",
    running: "oklch(0.62 0.12 230)",
    completed: "oklch(0.58 0.10 150)",
    failed: "var(--destructive)",
  }

  return {
    width: 190,
    border: `1px solid ${active ? "oklch(0.56 0.14 230)" : borderByStatus[node.status]}`,
    borderRadius: 10,
    background: backgroundByKind[node.kind],
    boxShadow: active ? "0 14px 30px oklch(0.2 0.03 250 / 0.10)" : "0 1px 2px oklch(0.2 0.02 250 / 0.06)",
    color: "var(--foreground)",
    fontSize: 12,
    lineHeight: 1.35,
    padding: 10,
  }
}
