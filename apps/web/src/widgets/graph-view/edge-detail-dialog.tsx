import { useMemo } from "react"
import { ArrowRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"
import { buildEdgeActorNames, buildEdgeInteractionHistory, type EdgeInteractionHistoryItem } from "./edge-history"

export function EdgeDetailDialog({
  t,
  edgeId,
  onOpenChange,
}: {
  t: UiTexts
  edgeId?: string
  onOpenChange: (open: boolean) => void
}) {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const runState = useRunStore((state) => state.runState)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const edge = frame?.edges.find((item) => item.id === edgeId)
  const names = useMemo(
    () => buildEdgeActorNames(frame?.nodes ?? [], liveEvents, runState?.actors ?? []),
    [frame?.nodes, liveEvents, runState?.actors]
  )
  const history = useMemo(
    () => buildEdgeInteractionHistory(edge, liveEvents, runState?.interactions ?? []),
    [edge, liveEvents, runState?.interactions]
  )
  const sourceName = edge ? names.get(edge.source) ?? edge.source : ""
  const targetName = edge ? names.get(edge.target) ?? edge.target : ""

  return (
    <Dialog open={Boolean(edge)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82svh] flex-col overflow-hidden sm:max-w-[860px]">
        {edge ? (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle>{t.graphEdgeDialogTitle}</DialogTitle>
              <DialogDescription>{t.graphEdgeHistoryDescription}</DialogDescription>
            </DialogHeader>

            <div className="flex shrink-0 flex-col gap-3 rounded-md bg-muted/30 p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">{sourceName}</span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-semibold">{targetName}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <EdgeStat label={t.graphEdgeInteractions} value={history.length} />
                <EdgeStat label={t.graphEdgeWeight} value={edge.weight} />
                <EdgeStat label={t.graphEdgeLatestRound} value={edge.roundIndex} prefix="R" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="rounded-sm bg-background">{edge.visibility}</Badge>
                <Badge variant="secondary" className="rounded-sm">{edge.id}</Badge>
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 pr-3">
              <div className="flex flex-col gap-2 pr-3 pt-3">
                {history.length ? history.map((item) => (
                  <EdgeHistoryCard key={item.id} item={item} t={t} />
                )) : (
                  <div className="rounded-md border border-dashed border-border/80 bg-background/60 p-4 text-sm">
                    <p className="font-medium">{t.graphEdgeNoHistory}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t.graphEdgeNoHistoryDescription}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function EdgeStat({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="rounded-md bg-background/70 px-2 py-2">
      <div className="font-mono text-base font-semibold leading-none">{prefix}{value}</div>
      <div className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  )
}

function EdgeHistoryCard({ item, t }: { item: EdgeInteractionHistoryItem; t: UiTexts }) {
  return (
    <article className="rounded-md bg-background/80 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold">R{item.roundIndex}</span>
        <Badge variant="outline" className="h-4 rounded-sm bg-background px-1.5 text-[10px]">{item.visibility}</Badge>
        <Badge variant="outline" className="h-4 rounded-sm bg-background px-1.5 text-[10px]">{item.decisionType}</Badge>
        <Badge variant="outline" className="h-4 rounded-sm bg-background px-1.5 text-[10px]">{item.actionType}</Badge>
      </div>
      <MarkdownContent compact className="mt-2" content={item.content} fallback="-" />
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MiniField label={t.intent} value={item.intent} />
        <MiniField label={t.expectation} value={item.expectation} />
      </div>
      {item.timestamp ? <time className="mt-2 block font-mono text-[10px] text-muted-foreground">{timeLabel(item.timestamp)}</time> : null}
    </article>
  )
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <MarkdownContent compact className="mt-1" content={value} fallback="-" />
    </div>
  )
}

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
