/**
 * Purpose: Present the latest generated interaction on a relationship preview.
 * Pattern: Read-only overlay component.
 * Usage: Rendered by GraphView for the focused edge.
 * Related: src/ui/components/graph/graph-view.tsx, src/ui/components/markdown/markdown-content.tsx
 */
import type { ActorState, GraphTimelineFrame } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { sanitizeActorVisibleText } from "@/ui/models/actors/actor-visible-text"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export function EdgePreview({
  edge,
  t,
  actorNames,
  actors,
}: {
  edge: NonNullable<GraphTimelineFrame["edges"][number]>
  t: UiTexts
  actorNames: Map<string, string>
  actors: ActorState[]
}) {
  const actionSummary = summarizeCounts(edge.actionTypes, actorNames, actors)
  const visibilitySummary = summarizeCounts(edge.visibilityMix)
  const latestActionType = sanitizeActorVisibleText(edge.latestActionType, actorNames, actors)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-foreground">{t.graphEdgeActions}</p>
        <span className="font-mono text-[11px] text-muted-foreground">{edge.weight}</span>
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
        <MarkdownContent generated inline content={actionSummary || latestActionType} fallback="-" />
      </p>
      <div className="flex flex-wrap gap-1.5">
        {latestActionType ? (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <MarkdownContent generated inline content={latestActionType} />
          </span>
        ) : null}
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {visibilitySummary || edge.visibility}
        </span>
      </div>
      {edge.latestContent ? (
        <MarkdownContent generated density="compact" className="line-clamp-2 text-xs leading-5 text-muted-foreground" content={edge.latestContent} />
      ) : null}
    </div>
  )
}

function summarizeCounts(
  counts: Record<string, number> | undefined,
  actorNames?: Map<string, string>,
  actors: ActorState[] = []
): string {
  return Object.entries(normalizeCountLabels(counts, actorNames, actors))
    .toSorted((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ")
}

function normalizeCountLabels(
  counts: Record<string, number> | undefined,
  actorNames?: Map<string, string>,
  actors: ActorState[] = []
): Record<string, number> {
  const normalized: Record<string, number> = {}
  for (const [label, count] of Object.entries(counts ?? {})) {
    const visibleLabel = actorNames ? sanitizeActorVisibleText(label, actorNames, actors) : label
    normalized[visibleLabel] = (normalized[visibleLabel] ?? 0) + count
  }
  return normalized
}
