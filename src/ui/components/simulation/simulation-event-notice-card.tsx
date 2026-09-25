/**
 * Purpose: Show and dismiss a world event with a bounded Motion presence transition.
 * Pattern: Keyed notification presence.
 * Usage: Rendered over the live graph by SimulationStage.
 * Related: src/ui/components/simulation/simulation-stage.tsx, src/ui/models/simulation/simulation-event-notice.ts
 */
import { XIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import type { SimulationEventNotice } from "@/ui/models/simulation/simulation-event-notice"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"

export function SimulationEventNoticeCard({
  notice,
  t,
  onDismiss,
}: {
  notice?: SimulationEventNotice
  t: UiTexts
  onDismiss: (dismissalKey: string) => void
}) {
  const reducedMotion = useReducedMotionPreference()
  return <AnimatePresence mode="wait">{notice ? (
    <m.div key={notice.dismissalKey} {...slidePresence(reducedMotion, "y", 6, -6, "page")}
      className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <article className="pointer-events-auto relative w-[min(420px,calc(100%-32px))] rounded-lg border border-amber-300/80 bg-background/95 p-4 text-center shadow-lg ring-1 ring-amber-200/70">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 size-7"
          aria-label={t.eventNoticeDismiss}
          onClick={() => onDismiss(notice.dismissalKey)}
        >
          <XIcon className="size-4" />
        </Button>
        <p className="text-xs font-semibold uppercase text-amber-700">
          {t.eventInjectedRound.replace("{round}", String(notice.event.roundIndex))}
        </p>
        <h3 className="mt-2 text-base font-semibold text-foreground">{notice.event.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{notice.event.summary}</p>
      </article>
    </m.div>
  ) : null}</AnimatePresence>
}
