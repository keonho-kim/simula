import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { UiTexts } from "@/lib/i18n"
import type { SimulationEventNotice } from "@/widgets/simulation-event-notice"

export function SimulationEventNoticeCard({
  notice,
  t,
  onDismiss,
}: {
  notice?: SimulationEventNotice
  t: UiTexts
  onDismiss: (dismissalKey: string) => void
}) {
  if (!notice) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
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
    </div>
  )
}
