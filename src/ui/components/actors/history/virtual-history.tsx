/**
 * Purpose: Virtualize archived actor messages against the report's full-viewport scroll surface.
 * Pattern: Lifecycle-owned virtual list.
 * Usage: Mounted by the report conversation panel inside a page-scroll dialog.
 * Related: src/ui/components/report/conversation-panel.tsx, src/ui/components/actors/history/message-card.tsx
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import type { ActorRound } from "@/ui/models/actors/actor-conversation"
import type { UiTexts } from "@/ui/types/i18n"
import { Separator } from "@/ui/components/ui/separator"
import { ActorMessageCard } from "./message-card"

export function VirtualActorHistory({ rounds, t, onActorSelect, onMessageSelect }: {
  rounds: ActorRound[]; t: UiTexts; onActorSelect: (id: string) => void; onMessageSelect?: (id: string) => void
}) {
  "use no memo"
  const root = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>()
  const [scrollMargin, setScrollMargin] = useState(0)
  const rows = useMemo(() => rounds.flatMap(round => [
    { key: `round:${round.roundIndex}`, roundIndex: round.roundIndex, message: undefined },
    ...round.messages.map(message => ({ key: `message:${message.id}`, roundIndex: round.roundIndex, message })),
  ]), [rounds])
  const getScrollElement = useCallback(() => root.current?.closest<HTMLElement>(".page-scroll-dialog") ?? null, [])
  const getItemKey = useCallback((index: number) => rows[index]!.key, [rows])
  // Measurements belong to this list and never cross into memoized message cards.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    getItemKey,
    rangeExtractor: range => {
      const visible = defaultRangeExtractor(range)
      return focusedIndex !== undefined && focusedIndex < rows.length && !visible.includes(focusedIndex)
        ? [...visible, focusedIndex].sort((a, b) => a - b) : visible
    },
    estimateSize: index => rows[index]?.message ? 220 : 30,
    scrollMargin,
    overscan: 8,
    gap: 16,
    paddingStart: 20,
    paddingEnd: 20,
    useAnimationFrameWithResizeObserver: true,
  })

  useLayoutEffect(() => {
    const element = root.current
    const scroll = getScrollElement()
    if (!element || !scroll) return
    const update = () => setScrollMargin(element.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    window.addEventListener("resize", update)
    return () => { observer.disconnect(); window.removeEventListener("resize", update) }
  }, [getScrollElement])
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    let width = element.clientWidth
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; virtualizer.measure() }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [virtualizer])

  return <div ref={root} className="relative min-w-0"
    onFocusCapture={event => {
      const index = (event.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index
      setFocusedIndex(index === undefined ? undefined : Number(index))
    }}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedIndex(undefined)
    }}>
    {rows.length === 0 ? <p role="status" className="px-5 py-12 text-center text-sm text-muted-foreground">{t.actorRailEmpty}</p> : null}
    <div data-history-items={rows.length} className="relative w-full" style={{ height: virtualizer.getTotalSize(), overflowAnchor: "none" }}>
      {virtualizer.getVirtualItems().map(item => {
        const row = rows[item.index]!
        return <div key={item.key} data-index={item.index} ref={virtualizer.measureElement}
          className="absolute left-4 right-4 top-0 sm:left-5 sm:right-5" style={{ transform: `translateY(${item.start - scrollMargin}px)` }}>
          {row.message ? <ActorMessageCard {...row.message} targets={row.message.targets.join(", ")} t={t} onActorSelect={onActorSelect} onMessageSelect={onMessageSelect} /> :
            <div className="flex items-center gap-3 py-2">
              <Separator className="flex-1" />
              <h3 id={`actor-round-${row.roundIndex}`} className="shrink-0 text-[11px] font-medium tracking-[0.16em] text-muted-foreground">ROUND {row.roundIndex}</h3>
              <Separator className="flex-1" />
            </div>}
        </div>
      })}
    </div>
  </div>
}
