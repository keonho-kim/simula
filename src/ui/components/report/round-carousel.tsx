/**
 * Purpose: Show all report rounds in a wrapping board with keyboard-friendly navigation.
 * Pattern: Controlled selection board.
 * Usage: Rendered by the report conversation panel.
 * Related: src/ui/components/report/conversation-panel.tsx
 */
import { reportStatusLabel } from "@/ui/models/report/status-label"
import { useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { roundCardMotion } from "@/ui/animation/interaction"
import { motionTransition } from "@/ui/animation/timing"
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
  const cards = useRef<Array<HTMLButtonElement | null>>([])
  const reducedMotion = useReducedMotionPreference()
  const [cursor, setCursor] = useState(0)
  const move = (direction: number) => {
    const next = Math.max(0, Math.min(rounds.length - 1, cursor + direction))
    setCursor(next)
    cards.current[next]?.focus()
    cards.current[next]?.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "instant" : "smooth" })
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
            disabled={cursor === 0}
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.reportNextRounds}
            disabled={cursor >= rounds.length - 1}
            onClick={() => move(1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pb-3" aria-label={t.reportRoundBoard}>
        {rounds.map((round, index) => (
          <m.button
            key={round.roundIndex}
            initial={false}
            {...roundCardMotion(reducedMotion)}
            ref={element => { cards.current[index] = element }}
            type="button"
            aria-pressed={selected === round.roundIndex}
            aria-label={`${t.round} ${round.roundIndex}`}
            onClick={() => { setCursor(index); onSelect(round.roundIndex) }}
            className={cn(
              "relative isolate flex min-w-0 max-w-[320px] flex-[1_1_230px] flex-col gap-3 rounded-md border bg-card p-4 text-left focus-visible:outline-2 focus-visible:outline-ring",
              selected === round.roundIndex ? "border-primary" : "border-border"
            )}
          >
            <m.span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-accent/30"
              initial={false} animate={{ opacity: selected === round.roundIndex ? 1 : 0 }}
              transition={motionTransition(reducedMotion, "content")} />
            <span className="text-xs font-medium text-muted-foreground">
              {t.round} {round.roundIndex}
            </span>
            {round.title ? <span className="text-sm font-semibold">{round.title}</span> : null}
            <span className="flex flex-col gap-2">
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
            <span className="text-xs leading-5 text-muted-foreground">
              {round.summary || t.waitingForActivity}
            </span>
          </m.button>
        ))}
      </div>
    </section>
  )
}
