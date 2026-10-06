/**
 * Purpose: Show simulation navigation, execution status, and playback controls.
 * Pattern: Presentation component.
 * Usage: Rendered by App in the simulation page toolbar.
 * Related: src/ui/shell/App.tsx, src/ui/components/navigation/run-navigation.tsx
 */
import { RunNavigation } from "./run-navigation"
import { Switch } from "@/ui/components/ui/switch"
import {
  ArrowRightIcon,
} from "lucide-react"
import { Badge } from "@/ui/components/ui/badge"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import { reportStatusLabel } from "@/ui/models/report/status-label"

interface TopCommandBarProps {
  title?: string
  selectedRunId?: string
  onBackToWorlds?: () => void
  autoContinue?: boolean
  onAutoContinueChange?: (enabled: boolean) => void
  autoContinueDisabled?: boolean
  selectedRunStatus?: string
  showReportShortcut?: boolean
  t: UiTexts
  onHome: () => void
  onReport?: () => void
}

export function TopCommandBar({
  title,
  selectedRunId,
  onBackToWorlds,
  autoContinue,
  onAutoContinueChange,
  autoContinueDisabled,
  selectedRunStatus,
  showReportShortcut = false,
  t,
  onHome,
  onReport,
}: TopCommandBarProps) {
  return (
    <header className="simulation-command-bar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words font-heading text-xl font-semibold leading-snug">{title ?? "Simula"}</h1>
              {selectedRunStatus ? (
                <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] uppercase tracking-normal">
                  {reportStatusLabel(selectedRunStatus, t)}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        {onAutoContinueChange && !showReportShortcut ? (
          <label className="flex flex-wrap items-center gap-2 text-xs">
            <Switch checked={autoContinue} disabled={autoContinueDisabled} onCheckedChange={onAutoContinueChange} />
            {t.autoContinue}
          </label>
        ) : null}
        {showReportShortcut && onReport ? (
          <Button className="rounded-md uppercase tracking-normal" onClick={onReport}>
            {t.report}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : null}
        </div>
      </div>
    </header>
  )
}
