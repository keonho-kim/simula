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
    created: t.reportStatusCreated
  }
  return labels[status] ?? status
}
