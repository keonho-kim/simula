/**
 * Purpose: Define the graph appearance and interaction component contract.
 * Pattern: Browser renderer contract.
 * Usage: Imported by GraphView and its renderer.
 * Related: src/ui/components/graph/graph-view.tsx
 */
import type { ActorState, GraphTimelineFrame } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"

export interface GraphViewProps {
  appearance?: import("../palette").GraphAppearance
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
