/**
 * Purpose: Virtualize live actor messages against the browser page scroll.
 * Pattern: Lifecycle-owned window virtual list with reader-controlled following.
 * Usage: Mounted by ActorRail on the simulation page.
 * Related: src/ui/models/actors/history-index.ts, src/ui/components/actors/history/message-card.tsx
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { defaultRangeExtractor, useWindowVirtualizer } from "@tanstack/react-virtual"
import type { ActorRound } from "@/ui/models/actors/actor-conversation"
import { buildHistoryIndex, historyRowAt } from "@/ui/models/actors/history-index"
import type { UiTexts } from "@/ui/types/i18n"
import { Separator } from "@/ui/components/ui/separator"
import { ActorMessageCard } from "./message-card"

export function WindowActorHistory({ rounds, t, onActorSelect, overlayOpen = false }: {
  rounds: ActorRound[]; t: UiTexts; onActorSelect: (id: string) => void; overlayOpen?: boolean
}) {
  "use no memo"
  const root = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const followingBeforeOverlay = useRef<boolean | undefined>(undefined)
  const [focusedIndex, setFocusedIndex] = useState<number>()
  const [scrollMargin, setScrollMargin] = useState(0)
  const history = useMemo(() => buildHistoryIndex(rounds), [rounds])
  const getItemKey = useCallback((index: number) => historyRowAt(history, index)!.key, [history])
  // The virtualizer owns mutable measurements and is not passed to memoized children.
  const virtualizer = useWindowVirtualizer({
    count: history.count,
    getItemKey,
    rangeExtractor: range => {
      const visible = defaultRangeExtractor(range)
      return focusedIndex !== undefined && focusedIndex < history.count && !visible.includes(focusedIndex)
        ? [...visible, focusedIndex].sort((a, b) => a - b) : visible
    },
    estimateSize: index => historyRowAt(history, index)?.message ? 220 : 30,
    scrollMargin,
    overscan: 8,
    gap: 16,
    paddingStart: 20,
    paddingEnd: 20,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: 1,
    useAnimationFrameWithResizeObserver: true,
  })

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const update = () => setScrollMargin(element.getBoundingClientRect().top + window.scrollY)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    window.addEventListener("resize", update)
    return () => { observer.disconnect(); window.removeEventListener("resize", update) }
  }, [])
  useLayoutEffect(() => { if (following.current && history.count && !overlayOpen) virtualizer.scrollToEnd() }, [overlayOpen, history.count, virtualizer])
  useLayoutEffect(() => {
    if (overlayOpen) { followingBeforeOverlay.current ??= following.current; return }
    if (!followingBeforeOverlay.current) { followingBeforeOverlay.current = undefined; return }
    const frame = requestAnimationFrame(() => {
      following.current = true
      virtualizer.scrollToEnd()
      followingBeforeOverlay.current = undefined
    })
    return () => cancelAnimationFrame(frame)
  }, [overlayOpen, virtualizer])
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    let width = element.clientWidth
    let previousTop = window.scrollY
    const recordPosition = () => {
      const top = window.scrollY
      if (!overlayOpen) {
        if (top < previousTop - 1) following.current = false
        else if (document.documentElement.scrollHeight - top - window.innerHeight <= 1) following.current = true
      }
      previousTop = top
    }
    window.addEventListener("scroll", recordPosition, { passive: true })
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; virtualizer.measure() }
      if (following.current && history.count && !overlayOpen) virtualizer.scrollToEnd()
    })
    observer.observe(element)
    const content = element.querySelector<HTMLElement>("[data-history-items]")
    if (content) observer.observe(content)
    return () => { observer.disconnect(); window.removeEventListener("scroll", recordPosition) }
  }, [overlayOpen, history.count, virtualizer])

  return <div ref={root} className="relative min-h-[560px] w-full"
    onFocusCapture={event => {
      const index = (event.target as HTMLElement).closest<HTMLElement>("[data-index]")?.dataset.index
      setFocusedIndex(index === undefined ? undefined : Number(index))
    }}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedIndex(undefined)
    }}>
    {history.count === 0 ? <p role="status" className="px-5 py-12 text-center text-sm text-muted-foreground">{t.actorRailEmpty}</p> : null}
    <div data-history-items={history.count} className="relative w-full" style={{ height: virtualizer.getTotalSize(), overflowAnchor: "none" }}>
      {virtualizer.getVirtualItems().map(item => {
        const row = historyRowAt(history, item.index)!
        return <div key={item.key} data-index={item.index} ref={virtualizer.measureElement}
          className="absolute left-4 right-4 top-0 sm:left-5 sm:right-5" style={{ transform: `translateY(${item.start - scrollMargin}px)` }}>
          {row.message ? <ActorMessageCard {...row.message} targets={row.message.targets.join(", ")} t={t} onActorSelect={onActorSelect} /> :
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
