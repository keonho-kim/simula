import type { ActorState, GraphTimelineFrame } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"

export interface GraphViewProps {
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
