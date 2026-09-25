/**
 * Purpose: Expose separate run queries through one test-only browser import.
 * Pattern: Test adapter.
 * Usage: Loaded only by Playwright through e2e-modules.ts.
 * Related: src/ui/shell/e2e-modules.ts, src/ui/browser-storage/database/runs/read-detail.ts
 */
export { appendRunEvents } from "@/ui/browser-storage/database/runs/append-events"
export { lastRunEventSequence } from "@/ui/browser-storage/database/runs/last-event-sequence"
export { listBrowserRuns } from "@/ui/browser-storage/database/runs/list"
export { markRunInterrupted } from "@/ui/browser-storage/database/runs/mark-interrupted"
export { readBrowserRun } from "@/ui/browser-storage/database/runs/read-detail"
export { readRoundEvents } from "@/ui/browser-storage/database/runs/read-round-events"
export { readRunReport } from "@/ui/browser-storage/database/runs/read-report"
export { saveRunDetail } from "@/ui/browser-storage/database/runs/save-detail"
export { saveRunManifest } from "@/ui/browser-storage/database/runs/save-manifest"
export { saveRunReport } from "@/ui/browser-storage/database/runs/save-report"
export type { BrowserRunDetail } from "@/ui/browser-storage/database/runs/types"
