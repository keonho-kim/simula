import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from "react"
import { DEFAULT_EDGE_CURVATURE, EdgeCurvedArrowProgram, indexParallelEdgesIndex } from "@sigma/edge-curve"
import Graph from "graphology"
import forceAtlas2 from "graphology-layout-forceatlas2"
import { CrosshairIcon, SearchIcon, XIcon } from "lucide-react"
import Sigma from "sigma"
import type { EdgeProgramType } from "sigma/rendering"
import type { GraphEdgeView, GraphNodeView, GraphTimelineFrame, RunEvent } from "@simula/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { UiTexts } from "@/lib/i18n"
import { useRunStore } from "@/store/run-store"

interface GraphViewProps {
  frame?: GraphTimelineFrame
  t: UiTexts
  selectedActorId?: string
  onActorSelect: (actorId: string | undefined) => void
  showActorPopover?: boolean
}

type ActorGraph = Graph<GraphNodeAttributes, GraphEdgeAttributes>
type Position = { x: number; y: number }

interface GraphNodeAttributes {
  label: string
  role: string
  intent: string
  size: number
  color: string
  x: number
  y: number
  interactionCount: number
  zIndex?: number
}

interface GraphEdgeAttributes {
  type: typeof EDGE_TYPE
  color: string
  size: number
  alpha: number
  visibility: GraphEdgeView["visibility"]
  latestContent: string
  weight: number
  curvature?: number
  parallelIndex?: number | null
  parallelMinIndex?: number | null
  parallelMaxIndex?: number | null
  zIndex?: number
}

interface LayoutAnimationState {
  frameId?: number
}

interface EdgeAnimation {
  startedAt: number
  duration: number
  fromSize: number
  toSize: number
  fromAlpha: number
  toAlpha: number
  visibility: GraphEdgeView["visibility"]
}

interface EdgeAnimationState {
  frameId?: number
  items: Map<string, EdgeAnimation>
}

interface ActorSignalBadge {
  actorId: string
  symbol: "!" | "?"
  step: string
  expiresAt: number
}

interface VisibleActorSignalBadge extends ActorSignalBadge {
  position: NodeOverlayPosition
}

interface NodeOverlayPosition {
  x: number
  y: number
  size: number
}

const ACTOR_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#64748b", "#f43f5e"]
const ACTIVE_COLOR = "#1f2a44"
const MUTED_NODE_COLOR = "#d7dee8"
const MUTED_EDGE_COLOR = "rgba(102, 112, 133, 0.22)"
const LARGE_GRAPH_LABEL_THRESHOLD = 120
const LAYOUT_ANIMATION_MS = 560
const EDGE_ANIMATION_MS = 420
const ACTIVE_NODE_TTL_MS = 1100
const SIGNAL_BADGE_TTL_MS = 4000
const ACTOR_POPOVER_WIDTH = 320
const EDGE_TYPE = "curvedArrow"

export function GraphView({ frame, t, selectedActorId, onActorSelect, showActorPopover = false }: GraphViewProps) {
  const liveEvents = useRunStore((state) => state.liveEvents)
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
  const activeNodeIdsRef = useRef<Set<string>>(new Set())
  const [hoveredNodeId, setHoveredNodeId] = useState<string>()
  const [overlayRevision, setOverlayRevision] = useState(0)
  const [signalBadges, setSignalBadges] = useState<Record<string, ActorSignalBadge>>({})
  const [visibleSignalBadges, setVisibleSignalBadges] = useState<VisibleActorSignalBadge[]>([])
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

  const actorNames = useMemo(() => buildActorNameMap(frame?.nodes ?? [], liveEvents), [frame?.nodes, liveEvents])
  const selectedActor = useMemo(
    () => frame?.nodes.find((node) => node.id === selectedActorId),
    [frame?.nodes, selectedActorId]
  )

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
    onActorSelect(nodeId)
    focusNode(nodeId)
  }, [focusNode, onActorSelect])

  useEffect(() => {
    selectedNodeRef.current = selectedActorId
    hoveredNodeRef.current = hoveredNodeId
    rendererRef.current?.refresh()
    requestOverlayRefresh()
  }, [hoveredNodeId, requestOverlayRefresh, selectedActorId])

  useEffect(() => {
    const renderer = rendererRef.current
    const graph = graphRef.current
    if (!selectedActorId) {
      setSelectedPopoverStyle(undefined)
    } else {
      const selectedPosition = nodeOverlayPosition(renderer, graph, selectedActorId)
      setSelectedPopoverStyle(selectedPosition ? actorPopoverStyle(renderer, selectedPosition) : undefined)
    }

    const now = Date.now()
    const nextBadges = Object.values(signalBadges)
      .filter((badge) => badge.expiresAt > now)
      .map((badge) => {
        const position = nodeOverlayPosition(renderer, graph, badge.actorId)
        return position ? { ...badge, position } : undefined
      })
      .filter((badge): badge is VisibleActorSignalBadge => Boolean(badge))
    setVisibleSignalBadges(nextBadges)
  }, [overlayRevision, selectedActorId, signalBadges])

  useEffect(() => {
    if (selectedActorId) {
      focusNode(selectedActorId)
    }
  }, [focusNode, selectedActorId])

  useEffect(() => {
    const now = Date.now()
    const nextBadges = new Map<string, ActorSignalBadge>()
    for (const event of liveEvents.slice(-50)) {
      if (event.type !== "model.message" || event.role !== "actor") {
        continue
      }
      const timestamp = Date.parse(event.timestamp)
      if (!Number.isFinite(timestamp) || now - timestamp > SIGNAL_BADGE_TTL_MS || timestamp - now > 10_000) {
        continue
      }
      const parsed = parseActorModelMessage(event.content, actorNames)
      if (!parsed) {
        continue
      }
      nextBadges.set(parsed.actorId, {
        actorId: parsed.actorId,
        symbol: signalSymbol(parsed.step),
        step: parsed.step,
        expiresAt: timestamp + SIGNAL_BADGE_TTL_MS,
      })
    }
    if (!nextBadges.size) {
      return
    }
    setSignalBadges((current) => {
      const next = { ...current }
      for (const [actorId, badge] of nextBadges) {
        next[actorId] = badge
      }
      return next
    })
  }, [actorNames, liveEvents])

  useEffect(() => {
    const badges = Object.values(signalBadges)
    if (!badges.length) {
      return
    }
    const nextExpiry = Math.min(...badges.map((badge) => badge.expiresAt))
    const timeoutId = window.setTimeout(() => {
      const now = Date.now()
      setSignalBadges((current) => Object.fromEntries(
        Object.entries(current).filter(([, badge]) => badge.expiresAt > now)
      ))
      requestOverlayRefresh()
    }, Math.max(0, nextExpiry - Date.now()) + 50)
    return () => window.clearTimeout(timeoutId)
  }, [requestOverlayRefresh, signalBadges])

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
      enableEdgeEvents: false,
      labelColor: { color: "#172033" },
      labelDensity: 0.08,
      labelFont: "Geist Variable, sans-serif",
      labelGridCellSize: 80,
      labelRenderedSizeThreshold: 9,
      renderEdgeLabels: false,
      zIndex: true,
      nodeReducer: (node, data) => reduceNode(graph, node, data, {
        activeNodeIds: activeNodeIdsRef.current,
        hoveredNodeId: hoveredNodeRef.current,
        selectedNodeId: selectedNodeRef.current,
      }),
      edgeReducer: (edge, data) => reduceEdge(graph, edge, data, {
        hoveredNodeId: hoveredNodeRef.current,
        selectedNodeId: selectedNodeRef.current,
      }),
    })

    rendererRef.current = renderer
    const updateOverlays = () => requestOverlayRefresh()
    renderer.getCamera().on("updated", updateOverlays)
    renderer.on("enterNode", ({ node }) => setHoveredNodeId(node))
    renderer.on("leaveNode", () => setHoveredNodeId(undefined))
    renderer.on("clickNode", ({ node }) => selectAndFocusNode(node))
    renderer.on("clickStage", () => onActorSelect(undefined))

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
  }, [onActorSelect, requestOverlayRefresh, selectAndFocusNode])

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

      {visibleSignalBadges.map((badge) => (
        <div
          key={badge.actorId}
          className="pointer-events-none absolute z-20 flex size-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-white bg-[#facc15] font-mono text-sm font-bold text-[#172033] shadow-[0_8px_20px_rgba(23,32,51,0.18)]"
          style={{ left: badge.position.x, top: badge.position.y - badge.position.size - 10 }}
          aria-label={`${t.graphActorSignal}: ${badge.step}`}
        >
          {badge.symbol}
        </div>
      ))}

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
            <div className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {selectedActor.interactionCount}
            </div>
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {selectedActor.intent || t.graphNoIntent}
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

function writeGraphFrame(
  graph: ActorGraph,
  frame: GraphTimelineFrame | undefined,
  nodePositions: Map<string, Position>,
  frameIndexRef: MutableRefObject<number | undefined>,
  layoutRoundRef: MutableRefObject<number | undefined>,
  layoutAnimation: LayoutAnimationState,
  edgeAnimation: EdgeAnimationState,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  onPositionsChanged?: () => void
): void {
  if (!frame) {
    cancelAnimation(layoutAnimation)
    cancelEdgeAnimation(edgeAnimation)
    graph.clear()
    nodePositions.clear()
    frameIndexRef.current = undefined
    layoutRoundRef.current = undefined
    return
  }
  if (frame.index === 0 || (frameIndexRef.current !== undefined && frame.index < frameIndexRef.current)) {
    cancelAnimation(layoutAnimation)
    cancelEdgeAnimation(edgeAnimation)
    graph.clear()
    nodePositions.clear()
    frameIndexRef.current = undefined
    layoutRoundRef.current = undefined
  }
  frameIndexRef.current = frame.index

  const nodes = frame?.nodes ?? []
  const nextNodeIds = new Set(nodes.map((node) => node.id))
  for (const nodeId of graph.nodes()) {
    if (!nextNodeIds.has(nodeId)) {
      graph.dropNode(nodeId)
      nodePositions.delete(nodeId)
    }
  }

  nodes.forEach((node, index) => {
    const position = nodePositions.get(node.id) ?? initialPosition(index, nodes.length)
    const attributes: GraphNodeAttributes = {
      label: node.label,
      role: node.role,
      intent: node.intent,
      interactionCount: node.interactionCount,
      size: nodeSize(node),
      color: actorColor(node.id),
      x: position.x,
      y: position.y,
    }
    nodePositions.set(node.id, position)
    if (graph.hasNode(node.id)) {
      graph.mergeNodeAttributes(node.id, {
        label: attributes.label,
        role: attributes.role,
        intent: attributes.intent,
        interactionCount: attributes.interactionCount,
        size: attributes.size,
        color: attributes.color,
      })
    } else {
      graph.addNode(node.id, attributes)
    }
  })

  const nextEdgeIds = new Set((frame?.edges ?? []).map((edge) => edge.id))
  for (const edgeId of graph.edges()) {
    if (!nextEdgeIds.has(edgeId)) {
      graph.dropEdge(edgeId)
      edgeAnimation.items.delete(edgeId)
    }
  }
  for (const edge of frame?.edges ?? []) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      continue
    }
    const targetSize = edgeSize(edge)
    const targetAlpha = edgeAlpha(edge.visibility)
    if (graph.hasEdge(edge.id)) {
      const current = graph.getEdgeAttributes(edge.id)
      graph.mergeEdgeAttributes(edge.id, {
        type: EDGE_TYPE,
        visibility: edge.visibility,
        latestContent: edge.latestContent,
        weight: edge.weight,
      })
      if (current.weight !== edge.weight || current.visibility !== edge.visibility) {
        queueEdgeAnimation(graph, renderer, edgeAnimation, edge.id, {
          visibility: edge.visibility,
          fromSize: current.size,
          toSize: targetSize,
          fromAlpha: current.alpha,
          toAlpha: targetAlpha,
          duration: EDGE_ANIMATION_MS,
        })
      }
      continue
    }
    const attributes: GraphEdgeAttributes = {
      type: EDGE_TYPE,
      color: edgeColor(edge.visibility, 0.08),
      size: 0.2,
      alpha: 0.08,
      visibility: edge.visibility,
      latestContent: edge.latestContent,
      weight: edge.weight,
    }
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes)
    queueEdgeAnimation(graph, renderer, edgeAnimation, edge.id, {
      visibility: edge.visibility,
      fromSize: attributes.size,
      toSize: targetSize,
      fromAlpha: attributes.alpha,
      toAlpha: targetAlpha,
      duration: EDGE_ANIMATION_MS,
    })
  }
  applyEdgeCurves(graph)

  if (
    frame.layoutRoundIndex !== undefined &&
    layoutRoundRef.current !== frame.layoutRoundIndex &&
    graph.order > 1
  ) {
    cancelAnimation(layoutAnimation)
    const startPositions = readNodePositions(graph)
    forceAtlas2.assign(graph, forceAtlasOptions(graph.order))
    const targetPositions = readNodePositions(graph)
    applyNodePositions(graph, startPositions)
    layoutRoundRef.current = frame.layoutRoundIndex
    animateNodePositions(graph, renderer, nodePositions, layoutAnimation, targetPositions, LAYOUT_ANIMATION_MS, onPositionsChanged)
  }
}

function animateNodePositions(
  graph: ActorGraph,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  nodePositions: Map<string, Position>,
  animation: LayoutAnimationState,
  targetPositions: Map<string, Position>,
  duration: number,
  onPositionsChanged?: () => void
): void {
  const startedAt = performance.now()
  const startPositions = readNodePositions(graph)
  const tick = (now: number) => {
    const progress = easeOutCubic(Math.min(1, (now - startedAt) / duration))
    for (const [nodeId, target] of targetPositions) {
      if (!graph.hasNode(nodeId)) {
        continue
      }
      const start = startPositions.get(nodeId) ?? target
      const position = {
        x: interpolate(start.x, target.x, progress),
        y: interpolate(start.y, target.y, progress),
      }
      graph.mergeNodeAttributes(nodeId, position)
      nodePositions.set(nodeId, position)
    }
    renderer?.refresh()
    onPositionsChanged?.()
    if (progress < 1) {
      animation.frameId = window.requestAnimationFrame(tick)
      return
    }
    animation.frameId = undefined
  }
  animation.frameId = window.requestAnimationFrame(tick)
}

function queueEdgeAnimation(
  graph: ActorGraph,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  animation: EdgeAnimationState,
  edgeId: string,
  input: Omit<EdgeAnimation, "startedAt">
): void {
  animation.items.set(edgeId, {
    ...input,
    startedAt: performance.now(),
  })
  if (animation.frameId !== undefined) {
    return
  }
  const tick = (now: number) => {
    for (const [id, item] of animation.items) {
      if (!graph.hasEdge(id)) {
        animation.items.delete(id)
        continue
      }
      const progress = easeOutCubic(Math.min(1, (now - item.startedAt) / item.duration))
      const alpha = interpolate(item.fromAlpha, item.toAlpha, progress)
      graph.mergeEdgeAttributes(id, {
        size: interpolate(item.fromSize, item.toSize, progress),
        alpha,
        color: edgeColor(item.visibility, alpha),
      })
      if (progress >= 1) {
        animation.items.delete(id)
      }
    }
    renderer?.refresh()
    animation.frameId = animation.items.size ? window.requestAnimationFrame(tick) : undefined
  }
  animation.frameId = window.requestAnimationFrame(tick)
}

function updateActiveNodes(
  actorIds: string[],
  activeUntil: Map<string, number>,
  activeNodeIdsRef: MutableRefObject<Set<string>>,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  frameRef: MutableRefObject<number | undefined>
): void {
  const now = performance.now()
  for (const actorId of actorIds) {
    activeUntil.set(actorId, now + ACTIVE_NODE_TTL_MS)
  }
  refreshActiveNodes(activeUntil, activeNodeIdsRef, renderer)
  if (frameRef.current !== undefined || !activeUntil.size) {
    return
  }
  const tick = () => {
    refreshActiveNodes(activeUntil, activeNodeIdsRef, renderer)
    frameRef.current = activeUntil.size ? window.requestAnimationFrame(tick) : undefined
  }
  frameRef.current = window.requestAnimationFrame(tick)
}

function refreshActiveNodes(
  activeUntil: Map<string, number>,
  activeNodeIdsRef: MutableRefObject<Set<string>>,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null
): void {
  const now = performance.now()
  const active = new Set<string>()
  for (const [actorId, until] of activeUntil) {
    if (until > now) {
      active.add(actorId)
    } else {
      activeUntil.delete(actorId)
    }
  }
  activeNodeIdsRef.current = active
  renderer?.refresh()
}

function readNodePositions(graph: ActorGraph): Map<string, Position> {
  const positions = new Map<string, Position>()
  graph.forEachNode((nodeId, attributes) => {
    positions.set(nodeId, { x: attributes.x, y: attributes.y })
  })
  return positions
}

function applyNodePositions(graph: ActorGraph, positions: Map<string, Position>): void {
  for (const [nodeId, position] of positions) {
    if (graph.hasNode(nodeId)) {
      graph.mergeNodeAttributes(nodeId, position)
    }
  }
}

function nodeOverlayPosition(
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  graph: ActorGraph | null,
  nodeId: string
): NodeOverlayPosition | undefined {
  if (!renderer || !graph || !graph.hasNode(nodeId)) {
    return undefined
  }
  const attributes = graph.getNodeAttributes(nodeId)
  const viewport = renderer.graphToViewport({ x: attributes.x, y: attributes.y })
  return { ...viewport, size: attributes.size }
}

function actorPopoverStyle(
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  position: NodeOverlayPosition
): CSSProperties | undefined {
  if (!renderer) {
    return undefined
  }
  const dimensions = renderer.getDimensions()
  const width = Math.min(ACTOR_POPOVER_WIDTH, Math.max(220, dimensions.width - 24))
  return {
    left: clamp(position.x - width / 2, 12, Math.max(12, dimensions.width - width - 12)),
    top: position.y + position.size + 18,
    width,
  }
}

function buildActorNameMap(nodes: GraphNodeView[], liveEvents: RunEvent[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const node of nodes) {
    names.set(node.id, node.label)
  }
  for (const event of liveEvents) {
    if (event.type === "actors.ready") {
      for (const actor of event.actors) {
        names.set(actor.id, actor.label)
      }
    }
    if (event.type === "actor.message") {
      names.set(event.actorId, event.actorName)
    }
  }
  return names
}

function parseActorModelMessage(content: string, actorNames: Map<string, string>): { actorId: string; step: string } | undefined {
  const entries = [...actorNames.entries()].toSorted((a, b) => b[1].length - a[1].length)
  for (const [actorId, name] of entries) {
    if (!content.startsWith(`${name} `)) {
      continue
    }
    const rest = content.slice(name.length + 1)
    const separatorIndex = rest.indexOf(":")
    if (separatorIndex < 1) {
      continue
    }
    return {
      actorId,
      step: rest.slice(0, separatorIndex).trim(),
    }
  }
  return undefined
}

function signalSymbol(step: string): "!" | "?" {
  return step === "thought" || step === "context" ? "?" : "!"
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cancelAnimation(animation: LayoutAnimationState): void {
  if (animation.frameId !== undefined) {
    window.cancelAnimationFrame(animation.frameId)
    animation.frameId = undefined
  }
}

function cancelEdgeAnimation(animation: EdgeAnimationState): void {
  if (animation.frameId !== undefined) {
    window.cancelAnimationFrame(animation.frameId)
    animation.frameId = undefined
  }
  animation.items.clear()
}

function reduceNode(
  graph: ActorGraph,
  node: string,
  data: GraphNodeAttributes,
  state: { activeNodeIds: Set<string>; hoveredNodeId?: string; selectedNodeId?: string }
): Partial<GraphNodeAttributes> {
  const focusNodeId = state.selectedNodeId ?? state.hoveredNodeId
  const focusExists = Boolean(focusNodeId && graph.hasNode(focusNodeId))
  const related =
    !focusExists ||
    node === focusNodeId ||
    graph.hasEdge(node, focusNodeId as string) ||
    graph.hasEdge(focusNodeId as string, node)
  const active = state.activeNodeIds.has(node)
  return {
    ...data,
    color: active || node === focusNodeId ? ACTIVE_COLOR : related ? data.color : MUTED_NODE_COLOR,
    label: shouldRenderLabel(graph, related, active, data) ? data.label : "",
    size: active || node === focusNodeId ? data.size + 2 : data.size,
    zIndex: active || node === focusNodeId ? 2 : related ? 1 : 0,
  }
}

function reduceEdge(
  graph: ActorGraph,
  edge: string,
  data: GraphEdgeAttributes,
  state: { hoveredNodeId?: string; selectedNodeId?: string }
): Partial<GraphEdgeAttributes> {
  const focusNodeId = state.selectedNodeId ?? state.hoveredNodeId
  if (!focusNodeId || !graph.hasNode(focusNodeId)) {
    return data
  }
  const source = graph.source(edge)
  const target = graph.target(edge)
  const related = source === focusNodeId || target === focusNodeId
  return {
    ...data,
    color: related ? data.color : MUTED_EDGE_COLOR,
    size: related ? data.size + 0.8 : Math.max(0.5, data.size * 0.45),
    zIndex: related ? 1 : 0,
  }
}

function initialPosition(index: number, total = 1): Position {
  const angle = index * 2.399963229728653
  const radius = 2 + Math.sqrt(index + 1) * (total > 300 ? 2.8 : 1.8)
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function forceAtlasOptions(order: number): Parameters<typeof forceAtlas2.assign>[1] {
  return {
    iterations: order > 300 ? 12 : order > 100 ? 35 : 80,
    getEdgeWeight: "weight",
    settings: {
      barnesHutOptimize: order > 80,
      edgeWeightInfluence: 0.8,
      gravity: order > 300 ? 1.4 : 0.8,
      scalingRatio: order > 300 ? 24 : 12,
      slowDown: order > 300 ? 4 : 2,
    },
  }
}

function shouldRenderLabel(graph: ActorGraph, related: boolean, active: boolean, data: GraphNodeAttributes): boolean {
  if (active) {
    return true
  }
  if (graph.order > LARGE_GRAPH_LABEL_THRESHOLD) {
    return related && data.size >= 10
  }
  return related || data.size >= 9
}

function nodeSize(node: GraphNodeView): number {
  return Math.min(14, 5 + Math.sqrt(node.interactionCount + 1) * 1.8)
}

function actorColor(id: string): string {
  return ACTOR_COLORS[hashString(id) % ACTOR_COLORS.length] ?? ACTOR_COLORS[0]
}

function edgeSize(edge: GraphEdgeView): number {
  return Math.min(5, 1 + edge.weight * 0.7)
}

function edgeAlpha(visibility: GraphEdgeView["visibility"]): number {
  if (visibility === "public") return 0.62
  if (visibility === "semi-public") return 0.58
  if (visibility === "private") return 0.56
  return 0.42
}

function edgeColor(visibility: GraphEdgeView["visibility"], alpha = edgeAlpha(visibility)): string {
  if (visibility === "public") return `rgba(59, 130, 246, ${alpha})`
  if (visibility === "semi-public") return `rgba(16, 185, 129, ${alpha})`
  if (visibility === "private") return `rgba(139, 92, 246, ${alpha})`
  return `rgba(100, 116, 139, ${alpha})`
}

function applyEdgeCurves(graph: ActorGraph): void {
  indexParallelEdgesIndex(graph)
  graph.forEachEdge((edge, attributes) => {
    const curvature = typeof attributes.parallelIndex === "number" && typeof attributes.parallelMaxIndex === "number"
      ? parallelEdgeCurvature(attributes.parallelIndex, attributes.parallelMaxIndex)
      : DEFAULT_EDGE_CURVATURE
    graph.mergeEdgeAttributes(edge, { type: EDGE_TYPE, curvature })
  })
}

function parallelEdgeCurvature(index: number, maxIndex: number): number {
  if (maxIndex <= 0 || index === 0) {
    return DEFAULT_EDGE_CURVATURE
  }
  if (index < 0) {
    return -parallelEdgeCurvature(-index, maxIndex)
  }
  const amplitude = 3.5
  const maxCurvature = amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE
  return (maxCurvature * index) / maxIndex
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3)
}

function hashString(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}
