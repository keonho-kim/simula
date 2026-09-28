/**
 * Purpose: Page through report rounds without scrolling the document from arrow controls.
 * Pattern: Controlled carousel window.
 * Usage: Rendered by the report conversation panel.
 * Related: src/ui/components/report/conversation-panel.tsx
 */
import { reportStatusLabel } from "@/ui/models/report/status-label"
import { useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { roundCardMotion } from "@/ui/animation/interaction"
import { motionTransition } from "@/ui/animation/timing"
import { sequencePresence } from "@/ui/animation/presence"
import type { ConversationRound } from "@/ui/models/report/conversation-board"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

const VISIBLE_ROUNDS = 3

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
  const focusAfterMove = useRef(false)
  const reducedMotion = useReducedMotionPreference()
  const [cursor, setCursor] = useState(0)
  const [direction, setDirection] = useState<-1 | 1>(1)
  const start = Math.min(cursor, Math.max(0, rounds.length - 1))
  const move = (step: -1 | 1) => {
    const next = Math.max(0, Math.min(rounds.length - 1, start + step))
    if (next === start) return
    focusAfterMove.current = true
    setDirection(step)
    setCursor(next)
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
            disabled={start === 0}
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.reportNextRounds}
            disabled={start >= rounds.length - 1}
            onClick={() => move(1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="min-w-0 overflow-hidden" aria-label={t.reportRoundBoard}>
        <AnimatePresence mode="wait" initial={false}><m.div key={start}
          className="flex min-w-0 gap-3 pb-3" {...sequencePresence(reducedMotion, direction)}>
        {rounds.slice(start, start + VISIBLE_ROUNDS).map((round, index) => (
          <m.button
            key={round.roundIndex}
            initial={false}
            {...roundCardMotion(reducedMotion)}
            ref={element => {
              if (index === 0 && element && focusAfterMove.current) {
                element.focus({ preventScroll: true })
                focusAfterMove.current = false
              }
            }}
            type="button"
            aria-pressed={selected === round.roundIndex}
            aria-label={`${t.round} ${round.roundIndex}`}
            onClick={() => onSelect(round.roundIndex)}
            className={cn(
              "relative isolate min-w-0 flex-1 flex-col gap-3 rounded-md border bg-card p-4 text-left focus-visible:outline-2 focus-visible:outline-ring",
              index === 0 ? "flex" : index === 1 ? "hidden sm:flex" : "hidden xl:flex",
              selected === round.roundIndex ? "border-primary" : "border-border"
            )}
          >
            <m.span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-md bg-accent/30"
              initial={false} animate={{ opacity: selected === round.roundIndex ? 1 : 0 }}
              transition={motionTransition(reducedMotion, "content")} />
            <span className="text-xs font-medium text-muted-foreground">
              {t.round} {round.roundIndex}
            </span>
            {round.title ? <span className="text-sm font-semibold"><MarkdownContent generated inline content={round.title} /></span> : null}
            <span className="flex flex-col gap-2">
              {round.events.map((event) => (
                <span key={event.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <MarkdownContent generated inline content={event.title} />
                  {event.status ? (
                    <Badge variant="secondary" title={t.reportLatestEventStatus}>
                      {reportStatusLabel(event.status, t)}
                    </Badge>
                  ) : null}
                </span>
              ))}
            </span>
            <span className="text-xs leading-5 text-muted-foreground">
              <MarkdownContent generated inline content={round.summary} fallback={t.waitingForActivity} />
            </span>
          </m.button>
        ))}
        </m.div></AnimatePresence>
      </div>
    </section>
  )
}
