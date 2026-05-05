import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { EdgeCurvedArrowProgram } from "@sigma/edge-curve"
import Graph from "graphology"
import { CrosshairIcon, Maximize2Icon, SearchIcon, XIcon } from "lucide-react"
import Sigma from "sigma"
import type { EdgeProgramType } from "sigma/rendering"
import type { ActorState, GraphTimelineFrame } from "@simula/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { UiTexts } from "@/lib/i18n"
import { cancelAnimation, cancelEdgeAnimation, updateActiveNodes } from "./animation"
import { MUTED_EDGE_COLOR, MUTED_NODE_COLOR } from "./constants"
import { writeGraphFrame } from "./frame-writer"
import { actorPopoverStyle, nodeOverlayPosition } from "./overlays"
import { reduceEdge, reduceNode } from "./styles"
import { sanitizeActorVisibleText } from "../actor-visible-text"
import {
  EDGE_TYPE,
  type ActorGraph,
  type EdgeAnimationState,
  type GraphEdgeAttributes,
  type GraphNodeAttributes,
  type LayoutAnimationState,
  type Position,
} from "./types"

interface GraphViewProps {
  frame?: GraphTimelineFrame
  t: UiTexts
  selectedActorId?: string
  onActorSelect: (actorId: string | undefined) => void
  onActorExpand?: (actorId: string) => void
  selectedEdgeId?: string
  onEdgeSelect?: (edgeId: string | undefined) => void
  showActorPopover?: boolean
  actors?: ActorState[]
}

export function GraphView({
  frame,
  t,
  selectedActorId,
  onActorSelect,
  onActorExpand,
  selectedEdgeId,
  onEdgeSelect,
  showActorPopover = false,
  actors = [],
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null>(null)
  const graphRef = useRef<ActorGraph | null>(null)
  const nodePositionsRef = useRef<Map<string, Position>>(new Map())
  const layoutRoundRef = useRef<number | undefined>(undefined)
  const frameIndexRef = useRef<number | undefined>(undefined)
  const layoutAnimationRef = useRef<LayoutAnimationState>({})
  const edgeAnimationRef = useRef<EdgeAnimationState>({ items: new Map() })
  const activeUntilRef = useRef<Map<string, number>>(new Map())
  const activeRefreshRef = useRef<number | undefined>(undefined)
  const hoveredNodeRef = useRef<string | undefined>(undefined)
  const selectedNodeRef = useRef<string | undefined>(undefined)
  const selectedEdgeRef = useRef<string | undefined>(undefined)
  const activeNodeIdsRef = useRef<Set<string>>(new Set())
  const [hoveredNodeId, setHoveredNodeId] = useState<string>()
  const [overlayRevision, setOverlayRevision] = useState(0)
  const [selectedPopoverStyle, setSelectedPopoverStyle] = useState<CSSProperties>()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const requestOverlayRefresh = useCallback(() => {
    setOverlayRevision((revision) => revision + 1)
  }, [])

  const searchResults = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()
    if (!normalized) {
      return []
    }
    return (frame?.nodes ?? [])
      .filter((node) => `${node.label} ${node.role}`.toLowerCase().includes(normalized))
      .slice(0, 6)
  }, [deferredQuery, frame])

  const selectedActor = useMemo(
    () => frame?.nodes.find((node) => node.id === selectedActorId),
    [frame?.nodes, selectedActorId]
  )
  const actorNames = useMemo(
    () => new Map([...(frame?.nodes ?? []).map((node) => [node.id, node.label] as const), ...actors.map((actor) => [actor.id, actor.name] as const)]),
    [actors, frame?.nodes]
  )
  const selectedActorIntent = sanitizeActorVisibleText(selectedActor?.intent, actorNames, actors)

  const focusNode = useCallback((nodeId: string) => {
    const graph = graphRef.current
    const renderer = rendererRef.current
    if (!graph || !renderer || !graph.hasNode(nodeId)) {
      return
    }
    renderer.refresh()
    const display = renderer.getNodeDisplayData(nodeId)
    if (!display) {
      return
    }
    const camera = renderer.getCamera()
    const current = camera.getState()
    void camera.animate(
      { x: display.x, y: display.y, angle: 0, ratio: Math.min(current.ratio, 0.9) },
      { duration: 320 }
    ).then(requestOverlayRefresh)
  }, [requestOverlayRefresh])

  const selectAndFocusNode = useCallback((nodeId: string) => {
    onEdgeSelect?.(undefined)
    onActorSelect(nodeId)
    focusNode(nodeId)
  }, [focusNode, onActorSelect, onEdgeSelect])

  const selectEdge = useCallback((edgeId: string) => {
    onActorSelect(undefined)
    onEdgeSelect?.(edgeId)
  }, [onActorSelect, onEdgeSelect])

  useEffect(() => {
    selectedNodeRef.current = selectedActorId
    hoveredNodeRef.current = hoveredNodeId
    selectedEdgeRef.current = selectedEdgeId
    rendererRef.current?.refresh()
    requestOverlayRefresh()
  }, [hoveredNodeId, requestOverlayRefresh, selectedActorId, selectedEdgeId])

  useEffect(() => {
    const renderer = rendererRef.current
    const graph = graphRef.current
    if (!selectedActorId) {
      setSelectedPopoverStyle(undefined)
    } else {
      const selectedPosition = nodeOverlayPosition(renderer, graph, selectedActorId)
      setSelectedPopoverStyle(selectedPosition ? actorPopoverStyle(renderer, selectedPosition) : undefined)
    }
  }, [overlayRevision, selectedActorId])

  useEffect(() => {
    if (selectedActorId) {
      focusNode(selectedActorId)
    }
  }, [focusNode, selectedActorId])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const layoutAnimation = layoutAnimationRef.current
    const edgeAnimation = edgeAnimationRef.current
    const graph: ActorGraph = new Graph({ type: "directed", multi: true })
    graphRef.current = graph
    const renderer = new Sigma<GraphNodeAttributes, GraphEdgeAttributes>(graph, containerRef.current, {
      allowInvalidContainer: true,
      defaultEdgeColor: MUTED_EDGE_COLOR,
      defaultEdgeType: EDGE_TYPE,
      defaultNodeColor: MUTED_NODE_COLOR,
      edgeProgramClasses: {
        [EDGE_TYPE]: EdgeCurvedArrowProgram as unknown as EdgeProgramType<GraphNodeAttributes, GraphEdgeAttributes>,
      },
      enableEdgeEvents: true,
      labelColor: { color: "#172033" },
      labelDensity: 0.12,
      labelFont: "Geist Variable, sans-serif",
      labelGridCellSize: 64,
      labelRenderedSizeThreshold: 7,
      renderEdgeLabels: false,
      zIndex: true,
      nodeReducer: (node, data) => reduceNode(graph, node, data, {
        activeNodeIds: activeNodeIdsRef.current,
        hoveredNodeId: hoveredNodeRef.current,
        selectedNodeId: selectedNodeRef.current,
        selectedEdgeId: selectedEdgeRef.current,
      }),
      edgeReducer: (edge, data) => reduceEdge(graph, edge, data, {
        hoveredNodeId: hoveredNodeRef.current,
        selectedNodeId: selectedNodeRef.current,
        selectedEdgeId: selectedEdgeRef.current,
      }),
    })

    rendererRef.current = renderer
    const updateOverlays = () => requestOverlayRefresh()
    renderer.getCamera().on("updated", updateOverlays)
    renderer.on("enterNode", ({ node }) => setHoveredNodeId(node))
    renderer.on("leaveNode", () => setHoveredNodeId(undefined))
    renderer.on("clickNode", ({ node }) => selectAndFocusNode(node))
    renderer.on("clickEdge", ({ edge }) => selectEdge(edge))
    renderer.on("clickStage", () => {
      onActorSelect(undefined)
      onEdgeSelect?.(undefined)
    })

    return () => {
      cancelAnimation(layoutAnimation)
      cancelEdgeAnimation(edgeAnimation)
      if (activeRefreshRef.current !== undefined) {
        window.cancelAnimationFrame(activeRefreshRef.current)
        activeRefreshRef.current = undefined
      }
      renderer.getCamera().off("updated", updateOverlays)
      renderer.kill()
      rendererRef.current = null
      graphRef.current = null
    }
  }, [onActorSelect, onEdgeSelect, requestOverlayRefresh, selectAndFocusNode, selectEdge])

  useEffect(() => {
    if (!graphRef.current) {
      return
    }
    updateActiveNodes(frame?.activeNodeIds ?? [], activeUntilRef.current, activeNodeIdsRef, rendererRef.current, activeRefreshRef)
    writeGraphFrame(
      graphRef.current,
      frame,
      nodePositionsRef.current,
      frameIndexRef,
      layoutRoundRef,
      layoutAnimationRef.current,
      edgeAnimationRef.current,
      rendererRef.current,
      requestOverlayRefresh
    )
    rendererRef.current?.refresh()
    requestOverlayRefresh()
  }, [frame, requestOverlayRefresh])

  const resetCamera = () => {
    rendererRef.current?.getCamera().animate({ x: 0, y: 0, angle: 0, ratio: 1 }, { duration: 260 })
  }

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-lg bg-white ring-1 ring-border/60">
      <div className="absolute left-3 top-3 z-10 flex w-[min(420px,calc(100%-24px))] flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/80 bg-white/95 p-1.5 shadow-[0_4px_16px_rgba(23,32,51,0.06)]">
          <SearchIcon className="ml-2 size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.graphFindActor}
            className="h-8 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
          />
          {query ? (
            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t.graphClearActorSearch} onClick={() => setQuery("")}>
              <XIcon className="size-4" />
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={t.graphResetView} onClick={resetCamera}>
            <CrosshairIcon className="size-4" />
          </Button>
        </div>

        {searchResults.length ? (
          <div className="rounded-md border border-border/80 bg-white/95 p-1 shadow-[0_4px_16px_rgba(23,32,51,0.06)]">
            {searchResults.map((actor) => (
              <button
                key={actor.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() => selectAndFocusNode(actor.id)}
              >
                <span className="truncate font-medium">{actor.label}</span>
                <span className="shrink-0 text-muted-foreground">{actor.interactionCount}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={containerRef} className="h-full min-h-[520px] bg-[radial-gradient(circle_at_center,#f8fafc_1px,transparent_1px)] [background-size:24px_24px]" />

      {showActorPopover && selectedActor && selectedPopoverStyle ? (
        <div
          className="absolute z-20 rounded-md border border-border/80 bg-white/95 p-3 text-left shadow-[0_12px_32px_rgba(23,32,51,0.14)] backdrop-blur"
          style={selectedPopoverStyle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{selectedActor.label}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{selectedActor.role}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {selectedActor.interactionCount}
              </div>
              {onActorExpand ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-sm"
                  aria-label={t.actorExpand}
                  onClick={(event) => {
                    event.stopPropagation()
                    onActorExpand(selectedActor.id)
                  }}
                >
                  <Maximize2Icon className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {selectedActorIntent || t.graphNoIntent}
          </p>
        </div>
      ) : null}

      {(frame?.nodes.length ?? 0) === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[320px] text-center">
            <p className="text-sm font-medium">{t.graphNoActorNetwork}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t.graphNoActorNetworkDescription}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
