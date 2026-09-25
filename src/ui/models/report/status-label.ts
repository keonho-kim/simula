/**
 * Purpose: Map run and report lifecycle states to localized UI labels.
 * Pattern: Pure presentation function.
 * Usage: Imported by report and navigation components.
 * Related: src/ui/i18n/messages/report.ts, src/ui/components/navigation/top-command-bar.tsx
 */
import type { UiTexts } from "@/ui/types/i18n"

export function reportStatusLabel(status: string, t: UiTexts): string {
  const labels: Record<string, string> = {
    pending: t.reportStatusPending,
    active: t.reportStatusActive,
    partial: t.reportStatusPartial,
    completed: t.reportStatusCompleted,
    missed: t.reportStatusMissed,
    failed: t.reportStatusFailed,
    canceled: t.reportStatusCanceled,
    running: t.reportStatusRunning,
    created: t.reportStatusCreated,
    interrupted: t.reportStatusInterrupted
  }
  return labels[status] ?? status
}
