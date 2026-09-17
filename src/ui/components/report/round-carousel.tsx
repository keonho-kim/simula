import { reportStatusLabel } from "@/ui/models/report/status-label"
import { useLayoutEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { useReducedMotionPreference } from "@/ui/hooks/use-reduced-motion-preference"
import type { ConversationRound } from "@/ui/models/report/conversation-board"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"

export function RoundCarousel({
  rounds,
  selected,
  onSelect,
  t
}: {
  rounds: ConversationRound[]
  selected?: number
  onSelect: (round: number) => void
  t: UiTexts
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotionPreference()
  const [edges, setEdges] = useState({ start: true, end: true })
  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const update = () => {
      const start = element.scrollLeft <= 1
      const end = element.scrollWidth - element.clientWidth - element.scrollLeft <= 1
      setEdges((previous) => (previous.start === start && previous.end === end ? previous : { start, end }))
    }
    update()
    element.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => {
      element.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [rounds])
  const move = (direction: number) => {
    const element = viewport.current
    if (element)
      element.scrollBy({
        left: direction * element.clientWidth,
        behavior: reducedMotion ? "instant" : "smooth"
      })
  }
  return (
    <section aria-label={t.reportRoundBoard} className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t.reportRoundBoard}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t.reportPreviousRounds}
            disabled={edges.start}
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.reportNextRounds}
            disabled={edges.end}
            onClick={() => move(1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div
        ref={viewport}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3"
        tabIndex={0}
        aria-label={t.reportRoundBoard}
      >
        {rounds.map((round) => (
          <button
            key={round.roundIndex}
            type="button"
            aria-pressed={selected === round.roundIndex}
            aria-label={`${t.round} ${round.roundIndex}`}
            onClick={() => onSelect(round.roundIndex)}
            className={cn(
              "flex w-[min(280px,80vw)] shrink-0 snap-start flex-col gap-3 rounded-md border p-4 text-left focus-visible:outline-2 focus-visible:outline-ring",
              selected === round.roundIndex ? "border-primary bg-accent/30" : "border-border bg-card"
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {t.round} {round.roundIndex}
            </span>
            {round.title ? <span className="text-sm font-semibold">{round.title}</span> : null}
            <span className="flex max-h-28 flex-col gap-2 overflow-y-auto">
              {round.events.map((event) => (
                <span key={event.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <span>{event.title}</span>
                  {event.status ? (
                    <Badge variant="secondary" title={t.reportLatestEventStatus}>
                      {reportStatusLabel(event.status, t)}
                    </Badge>
                  ) : null}
                </span>
              ))}
            </span>
            <span className="line-clamp-3 text-xs leading-5 text-muted-foreground">
              {round.summary || t.waitingForActivity}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
