import { memo } from "react"
import { CrosshairIcon, Maximize2Icon } from "lucide-react"
import { Button } from "@/ui/components/ui/button"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { EdgePreview } from "@/ui/components/graph/overlays/edge-preview"
import { useGraphRenderer } from "@/ui/components/graph/renderer/use-graph-renderer"
import type { GraphViewProps } from "@/ui/components/graph/renderer/types"

export const GraphView = memo(function GraphView(props: GraphViewProps) {
  const { t, frame, showActorPopover, onActorExpand } = props
  const { containerRef, selectedActor, selectedPopoverStyle, selectedActorIntent,
    previewEdge, edgePreviewStyle, actorNames, actors, resetCamera } = useGraphRenderer(props)
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-lg bg-white ring-1 ring-border/60">
      <div className="absolute right-3 top-3 z-10">
        <Button variant="outline" size="icon" aria-label={t.graphResetView} onClick={resetCamera}><CrosshairIcon /></Button>
      </div>

      <div ref={containerRef} className="h-full min-h-[520px] bg-[radial-gradient(circle_at_center,#f8fafc_1px,transparent_1px)] [background-size:24px_24px]" />

      {showActorPopover && selectedActor && selectedPopoverStyle ? (
        <div
          className="absolute z-20 rounded-md border border-border/80 bg-white/95 p-3 text-left shadow-[0_12px_32px_rgba(23,32,51,0.14)] "
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
          <MarkdownContent compact className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground" content={selectedActorIntent} fallback={t.graphNoIntent} />
        </div>
      ) : null}

      {previewEdge ? (
        <div
          className="pointer-events-none absolute z-20 w-[min(340px,calc(100%-24px))] rounded-md border border-border/80 bg-white/95 p-3 text-left shadow-[0_12px_32px_rgba(23,32,51,0.12)] "
          style={edgePreviewStyle ?? { right: 12, top: 12 }}
        >
          <EdgePreview edge={previewEdge} t={t} actorNames={actorNames} actors={actors} />
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
})
