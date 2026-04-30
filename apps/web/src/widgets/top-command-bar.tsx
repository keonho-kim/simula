import {
  ArrowRightIcon,
  HomeIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UiTexts } from "@/lib/i18n"

interface TopCommandBarProps {
  selectedRunStatus?: string
  showReportShortcut?: boolean
  t: UiTexts
  onHome: () => void
  onReport?: () => void
}

export function TopCommandBar({
  selectedRunStatus,
  showReportShortcut = false,
  t,
  onHome,
  onReport,
}: TopCommandBarProps) {
  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/92 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label={t.home} variant="ghost" size="icon" className="rounded-md" onClick={onHome}>
            <HomeIcon />
            <span className="sr-only">{t.home}</span>
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-heading text-lg font-semibold tracking-normal">Simula</h1>
              {selectedRunStatus ? (
                <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] uppercase tracking-normal">
                  {selectedRunStatus}
                </Badge>
              ) : null}
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>
        {showReportShortcut && onReport ? (
          <Button className="rounded-md uppercase tracking-normal" onClick={onReport}>
            {t.report}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </header>
  )
}
