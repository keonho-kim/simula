/**
 * Purpose: Expose separate artifact queries through one test-only browser import.
 * Pattern: Test adapter.
 * Usage: Loaded only by Playwright through e2e-modules.ts.
 * Related: src/ui/shell/e2e-modules.ts, src/ui/browser-storage/database/artifacts/read.ts
 */
export { readBrowserArtifact } from "@/ui/browser-storage/database/artifacts/read"
export { saveBrowserArtifact } from "@/ui/browser-storage/database/artifacts/save"
