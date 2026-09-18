import { createLayoutWorker } from "../layout/worker-client"
import type { GraphViewProps } from "@/ui/components/graph/renderer/types"
import { edgePreviewStyleFromEvent } from "@/ui/components/graph/overlays/pointer-position"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { EdgeCurvedArrowProgram } from "@sigma/edge-curve"
import Graph from "graphology"
import Sigma from "sigma"
import type { EdgeProgramType } from "sigma/rendering"
import type { ActorState } from "@/shared"
import { animateNodePositions, cancelAnimation } from "@/ui/components/graph/animation"
import { updateActiveNodes } from "@/ui/components/graph/active-nodes"
import { LAYOUT_ANIMATION_MS, MUTED_EDGE_COLOR, MUTED_NODE_COLOR } from "@/ui/components/graph/constants"
import { writeGraphFrame } from "@/ui/components/graph/frame-writer"
import { actorPopoverStyle, nodeOverlayPosition } from "@/ui/components/graph/overlays/node-position"
import { collectNodeDepths, reduceEdge, reduceNode } from "@/ui/components/graph/styles"
import { sanitizeActorVisibleText } from "@/ui/models/actors/actor-visible-text"
import {
  EDGE_TYPE,
  type ActorGraph,
  type GraphEdgeAttributes,
  type GraphNodeAttributes,
  type LayoutAnimationState,
  type Position,
} from "@/ui/components/graph/types"

const EMPTY_ACTORS: ActorState[] = []

export function useGraphRenderer({
  frame,
  selectedActorId,
  onActorSelect,
  selectedEdgeId,
  onEdgeSelect,
  actors = EMPTY_ACTORS,
  showActorPopover,
}: GraphViewProps) {
  const layoutWorkerRef = useRef<ReturnType<typeof createLayoutWorker> | null>(null)
  const [layoutError, setLayoutError] = useState<Error>()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null>(null)
  const graphRef = useRef<ActorGraph | null>(null)
  const nodePositionsRef = useRef<Map<string, Position>>(new Map())
  const layoutRoundRef = useRef<number | undefined>(undefined)
  const frameIndexRef = useRef<number | undefined>(undefined)
  const layoutAnimationRef = useRef<LayoutAnimationState>({})
  const activeUntilRef = useRef<Map<string, number>>(new Map())
  const activeRefreshRef = useRef<number | undefined>(undefined)
  const hoveredNodeRef = useRef<string | undefined>(undefined)
  const selectedNodeRef = useRef<string | undefined>(undefined)
  const selectedEdgeRef = useRef<string | undefined>(undefined)
  const hoveredEdgeRef = useRef<string | undefined>(undefined)
  const activeNodeIdsRef = useRef<Set<string>>(new Set())
  const highlightedNodeDepthsRef = useRef<Map<string, number>>(new Map())
  const [hoveredNodeId, setHoveredNodeId] = useState<string>()
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string>()
  const [selectedPopoverStyle, setSelectedPopoverStyle] = useState<CSSProperties>()
  const [edgePreviewStyle, setEdgePreviewStyle] = useState<CSSProperties>()
  const requestOverlayRefresh = useCallback(() => {
    const renderer = rendererRef.current
    const nodeId = selectedNodeRef.current
    if (!showActorPopover || !nodeId) return
    const position = nodeOverlayPosition(renderer, graphRef.current, nodeId)
    const next = position ? actorPopoverStyle(renderer, position) : undefined
    setSelectedPopoverStyle((previous) =>
      previous?.left === next?.left && previous?.top === next?.top && previous?.width === next?.width ? previous : next)
  }, [showActorPopover])
  const updateSelectedDepths = useCallback(() => {
    highlightedNodeDepthsRef.current = collectNodeDepths(graphRef.current, selectedNodeRef.current, 2)
  }, [])

  const selectedActor = useMemo(
    () => frame?.nodes.find((node) => node.id === selectedActorId),
    [frame?.nodes, selectedActorId]
  )
  const previewEdge = useMemo(
    () => frame?.edges.find((edge) => edge.id === (selectedEdgeId ?? hoveredEdgeId)),
    [frame?.edges, hoveredEdgeId, selectedEdgeId]
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
      { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120 }
    )
  }, [])

  const selectAndFocusNode = useCallback((nodeId: string) => {
    onEdgeSelect?.(undefined)
    onActorSelect(nodeId)
    if (selectedNodeRef.current === nodeId) focusNode(nodeId)
  }, [focusNode, onActorSelect, onEdgeSelect])

  const selectEdge = useCallback((edgeId: string) => {
    onActorSelect(undefined)
    onEdgeSelect?.(edgeId)
  }, [onActorSelect, onEdgeSelect])

  const updateEdgePreviewPosition = useCallback((event: MouseEvent | TouchEvent | PointerEvent) => {
    setEdgePreviewStyle(edgePreviewStyleFromEvent(event, containerRef.current))
  }, [])

  useEffect(() => {
    selectedNodeRef.current = selectedActorId
    if (!selectedActorId) setSelectedPopoverStyle(undefined)
    hoveredNodeRef.current = hoveredNodeId
    selectedEdgeRef.current = selectedEdgeId
    hoveredEdgeRef.current = hoveredEdgeId
    updateSelectedDepths()
    rendererRef.current?.scheduleRefresh()
  }, [hoveredEdgeId, hoveredNodeId, requestOverlayRefresh, selectedActorId, selectedEdgeId, updateSelectedDepths])

  useEffect(() => {
    if (selectedActorId) {
      focusNode(selectedActorId)
    }
  }, [focusNode, selectedActorId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const layoutAnimation = layoutAnimationRef.current
    const activeUntil = activeUntilRef.current
    const graph: ActorGraph = new Graph({ type: "directed", multi: true })
    graphRef.current = graph
    const renderer = new Sigma<GraphNodeAttributes, GraphEdgeAttributes>(graph, container, {
      allowInvalidContainer: true,
      defaultEdgeColor: MUTED_EDGE_COLOR,
      defaultEdgeType: EDGE_TYPE,
      defaultNodeColor: MUTED_NODE_COLOR,
      minEdgeThickness: 1.2,
      edgeProgramClasses: {
        [EDGE_TYPE]: EdgeCurvedArrowProgram as unknown as EdgeProgramType<GraphNodeAttributes, GraphEdgeAttributes>,
      },
      enableEdgeEvents: Boolean(onEdgeSelect),
      labelColor: { color: "#172033" },
      labelDensity: 0.12,
      labelFont: "Geist Variable, sans-serif",
      labelGridCellSize: 64,
      labelRenderedSizeThreshold: 7,
      renderEdgeLabels: false,
      zIndex: true,
      nodeReducer: (node, data) => reduceNode(graph, node, data, {
        activeNodeIds: activeNodeIdsRef.current,
        highlightedNodeDepths: highlightedNodeDepthsRef.current,
        hoveredNodeId: hoveredNodeRef.current,
        selectedNodeId: selectedNodeRef.current,
        selectedEdgeId: selectedEdgeRef.current,
      }),
      edgeReducer: (edge, data) => reduceEdge(graph, edge, data, {
        highlightedNodeDepths: highlightedNodeDepthsRef.current,
        hoveredNodeId: hoveredNodeRef.current,
        selectedNodeId: selectedNodeRef.current,
        hoveredEdgeId: hoveredEdgeRef.current,
        selectedEdgeId: selectedEdgeRef.current,
      }),
    })

    rendererRef.current = renderer
    const layoutWorker = createLayoutWorker((positions) => {
      cancelAnimation(layoutAnimation)
      animateNodePositions(graph, nodePositionsRef.current, layoutAnimation, new Map(positions), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : LAYOUT_ANIMATION_MS)
    }, setLayoutError)
    layoutWorkerRef.current = layoutWorker
    const updateOverlays = () => requestOverlayRefresh()
    const updateHoveredEdgePreview = (event: PointerEvent) => {
      if (hoveredEdgeRef.current) {
        updateEdgePreviewPosition(event)
      }
    }
    renderer.on("afterRender", updateOverlays)
    renderer.on("enterNode", ({ node }) => setHoveredNodeId(node))
    renderer.on("leaveNode", () => setHoveredNodeId(undefined))
    renderer.on("enterEdge", ({ edge, event }) => {
      setHoveredEdgeId(edge)
      updateEdgePreviewPosition(event.original)
    })
    renderer.on("leaveEdge", () => {
      setHoveredEdgeId(undefined)
      if (!selectedEdgeRef.current) {
        setEdgePreviewStyle(undefined)
      }
    })
    renderer.on("clickNode", ({ node }) => selectAndFocusNode(node))
    renderer.on("clickEdge", ({ edge, event }) => {
      updateEdgePreviewPosition(event.original)
      selectEdge(edge)
    })
    renderer.on("clickStage", () => {
      setHoveredEdgeId(undefined)
      setEdgePreviewStyle(undefined)
      onActorSelect(undefined)
      onEdgeSelect?.(undefined)
    })
    container.addEventListener("pointermove", updateHoveredEdgePreview)

    return () => {
      layoutWorker.cancel()
      layoutWorkerRef.current = null
      cancelAnimation(layoutAnimation)
      if (activeRefreshRef.current !== undefined) {
        window.clearTimeout(activeRefreshRef.current)
        activeRefreshRef.current = undefined
      }
      container.removeEventListener("pointermove", updateHoveredEdgePreview)
      renderer.off("afterRender", updateOverlays)
      activeUntil.clear()
      activeNodeIdsRef.current = new Set()
      renderer.kill()
      rendererRef.current = null
      graphRef.current = null
    }
  }, [onActorSelect, onEdgeSelect, requestOverlayRefresh, selectAndFocusNode, selectEdge, updateEdgePreviewPosition])

  useEffect(() => {
    if (!graphRef.current) {
      return
    }
    if (!frame || frame.index === 0 || (frameIndexRef.current !== undefined && frame.index < frameIndexRef.current)) {
      layoutWorkerRef.current?.cancel()
    }
    updateActiveNodes(frame?.activeNodeIds ?? [], activeUntilRef.current, activeNodeIdsRef, rendererRef.current, activeRefreshRef)
    const topologyChanged = writeGraphFrame(
      graphRef.current,
      frame,
      nodePositionsRef.current,
      frameIndexRef,
      layoutRoundRef,
      layoutAnimationRef.current
    )
    if (frame?.layoutRoundIndex !== undefined && layoutRoundRef.current !== frame.layoutRoundIndex && graphRef.current.order > 1) {
      cancelAnimation(layoutAnimationRef.current)
      layoutRoundRef.current = frame.layoutRoundIndex
      layoutWorkerRef.current?.request(graphRef.current)
    }
    if (topologyChanged) {
      updateSelectedDepths()
      rendererRef.current?.scheduleRefresh()
    }
  }, [frame, requestOverlayRefresh, updateSelectedDepths])

  const resetCamera = () => {
    rendererRef.current?.getCamera().animate({ x: 0, y: 0, angle: 0, ratio: 1 }, { duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120 })
  }

  if (layoutError) throw layoutError

  return { containerRef, selectedActor, selectedPopoverStyle, selectedActorIntent,
    previewEdge, edgePreviewStyle, actorNames, actors, resetCamera }
}
