/**
 * Purpose: Expose existing browser modules to Playwright without Vite source URLs.
 * Pattern: Test-only adapter.
 * Usage: Loaded by client-root only in a NEXT_PUBLIC_SIMULA_E2E build.
 * Related: src/ui/shell/client-root.tsx, apps/web/e2e/browser-database.e2e.ts
 */
const modules: Record<string, () => Promise<unknown>> = {
  "/src/ui/api-client/client.ts": () => import("@/ui/api-client/client"),
  "/src/ui/browser-storage/backup.ts": () => import("@/ui/browser-storage/backup"),
  "/src/ui/shell/e2e-queries/artifacts.ts": () => import("@/ui/shell/e2e-queries/artifacts"),
  "/src/ui/shell/e2e-queries/attachments.ts": () => import("@/ui/shell/e2e-queries/attachments"),
  "/src/ui/browser-storage/database/connection.ts": () => import("@/ui/browser-storage/database/connection"),
  "/src/ui/browser-storage/database/credential-vault.ts": () => import("@/ui/browser-storage/database/credential-vault"),
  "/src/ui/shell/e2e-queries/drafts.ts": () => import("@/ui/shell/e2e-queries/drafts"),
  "/src/ui/shell/e2e-queries/runs.ts": () => import("@/ui/shell/e2e-queries/runs"),
  "/src/ui/browser-storage/scenario-builder-session.ts": () => import("@/ui/browser-storage/scenario-builder-session"),
  "/src/ui/stores/run-store.ts": () => import("@/ui/stores/run-store"),
  "/src/ui/components/graph/layout/layout.worker.ts?worker": async () => ({ default: LayoutWorker }),
}

function LayoutWorker(): Worker {
  return new Worker(new URL("../components/graph/layout/layout.worker.ts", import.meta.url), { type: "module" })
}

declare global {
  interface Window {
    // Test modules have unrelated exports, so the dynamic test-only boundary is intentionally untyped.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __simulaE2E?: { import: (path: string) => Promise<any> }
  }
}

export async function importTestModule(path: string): Promise<unknown> {
  const load = modules[path]
  if (!load) throw new Error(`Unknown test module: ${path}`)
  return load()
}
