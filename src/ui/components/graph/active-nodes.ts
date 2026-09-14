import type { MutableRefObject } from "react"
import type Sigma from "sigma"
import { ACTIVE_NODE_TTL_MS } from "@/ui/components/graph/constants"
import type { GraphEdgeAttributes, GraphNodeAttributes } from "@/ui/components/graph/types"

// Active highlighting changes only on activation or expiry, not on every animation frame.
export function updateActiveNodes(
  actorIds: string[],
  activeUntil: Map<string, number>,
  activeNodeIdsRef: MutableRefObject<Set<string>>,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  timerRef: MutableRefObject<number | undefined>
): void {
  const now = performance.now()
  for (const actorId of actorIds) activeUntil.set(actorId, now + ACTIVE_NODE_TTL_MS)
  if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)

  const refresh = () => {
    const now = performance.now()
    const active = new Set<string>()
    let nextExpiry = Infinity
    for (const [actorId, until] of activeUntil) {
      if (until <= now) activeUntil.delete(actorId)
      else {
        active.add(actorId)
        nextExpiry = Math.min(nextExpiry, until)
      }
    }
    const previous = activeNodeIdsRef.current
    if (active.size !== previous.size || [...active].some((id) => !previous.has(id))) {
      activeNodeIdsRef.current = active
      renderer?.scheduleRefresh()
    }
    timerRef.current = active.size ? window.setTimeout(refresh, Math.max(0, nextExpiry - now)) : undefined
  }
  refresh()
}
