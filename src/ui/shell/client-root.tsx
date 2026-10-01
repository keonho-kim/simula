/**
 * Purpose: Open browser storage and keep model settings synchronized with the active server session.
 * Pattern: Browser composition root.
 * Usage: Dynamically loaded by src/app/client-app.tsx after hydration.
 * Related: src/ui/browser-storage/tab-ownership.ts, src/ui/browser-storage/browser-presence.ts, src/ui/pages/credential-gate.tsx
 */
"use client"

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/ui/components/ui/tooltip"
import { Toaster } from "@/ui/components/ui/sonner"
import { BlockedTab } from "@/ui/pages/blocked-tab"
import { Button } from "@/ui/components/ui/button"
import { claimPrimaryTab, type TabOwnership } from "@/ui/browser-storage/tab-ownership"
import { startBrowserPresence } from "@/ui/browser-storage/browser-presence"
import { useLocaleText } from "@/ui/hooks/use-locale-text"

const queryClient = new QueryClient()
const AnimationProvider = lazy(() => import("@/ui/animation/provider"))
const App = lazy(() => import("@/ui/shell/App"))
const CredentialGate = lazy(() => import("@/ui/pages/credential-gate").then(module => ({ default: module.CredentialGate })))
if (process.env.NEXT_PUBLIC_SIMULA_E2E === "1") {
  window.__simulaE2E = { import: path => import("./e2e-modules").then(module => module.importTestModule(path)) }
}

interface Startup { ownership: TabOwnership; lockedVault: boolean; storageError?: string; settingsSyncFailed?: boolean }

async function beginStartup(): Promise<Startup> {
  const ownership = await claimPrimaryTab()
  if (ownership !== "owner") return { ownership, lockedVault: false }
  try {
    const [{ browserDatabase }, { hasCredentialVault }] = await Promise.all([
      import("@/ui/browser-storage/database/connection"),
      import("@/ui/browser-storage/database/credential-vault"),
    ])
    await browserDatabase()
    const lockedVault = await hasCredentialVault()
    if (lockedVault) return { ownership, lockedVault }
    const { readLocalSettings } = await import("@/ui/browser-storage/database/settings/read")
    if (!await readLocalSettings()) return { ownership, lockedVault }
    try {
      const { syncActiveSettings } = await import("@/ui/api-client/client")
      await syncActiveSettings()
      return { ownership, lockedVault }
    } catch { return { ownership, lockedVault, settingsSyncFailed: true } }
  } catch (error) {
    return { ownership, lockedVault: false, storageError: error instanceof Error ? error.message : "Browser storage failed." }
  }
}

let startup: Promise<Startup> | undefined

export default function ClientRoot() {
  const [state, setState] = useState<Startup>()
  const [sessionSync, setSessionSync] = useState<"ready" | "syncing" | "failed">("ready")
  const syncRevision = useRef(0)
  const { t } = useLocaleText()
  const restoreServerSettings = useCallback(async () => {
    const revision = ++syncRevision.current
    setSessionSync("syncing")
    try {
      const { hasCredentialVault, readUnlockedSecrets } = await import("@/ui/browser-storage/database/credential-vault")
      if (readUnlockedSecrets() || !await hasCredentialVault()) {
        const { syncActiveSettings } = await import("@/ui/api-client/client")
        await syncActiveSettings()
      }
      if (revision === syncRevision.current) setSessionSync("ready")
    } catch {
      if (revision === syncRevision.current) setSessionSync("failed")
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["runs"] })
    }
  }, [])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      startup ??= beginStartup()
      void startup.then(result => {
        setState(result)
        if (result.settingsSyncFailed) setSessionSync("failed")
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (state?.ownership !== "owner" || state.storageError) return
    return startBrowserPresence(() => { void restoreServerSettings() })
  }, [state?.ownership, state?.storageError, restoreServerSettings])
  if (!state) return <main className="mx-auto flex min-h-svh w-4/5 flex-col justify-center text-center">
    <h1 className="font-heading text-4xl font-semibold sm:text-5xl">Simula</h1>
    <p role="status" className="mt-4 text-sm text-muted-foreground">{t.browserStorageOpening}</p>
  </main>
  const ownedContent = sessionSync === "ready" ? <AnimationProvider>
    {state.lockedVault ? <CredentialGate><App /></CredentialGate> : <App />}
  </AnimationProvider> : <main className="mx-auto flex min-h-svh w-4/5 flex-col justify-center gap-4">
    <p role={sessionSync === "failed" ? "alert" : "status"} className="text-sm text-foreground">
      {sessionSync === "failed" ? t.settingsSyncFailed : t.settingsLoading}
    </p>
    {sessionSync === "failed" ? <Button onClick={() => void restoreServerSettings()}>{t.settingsRetry}</Button> : null}
  </main>
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">{t.browserStorageOpening}</p>}>
        {state.ownership === "owner" && !state.storageError ? ownedContent
          : <BlockedTab unsupported={state.ownership === "unsupported" || Boolean(state.storageError)} detail={state.storageError} />}
      </Suspense>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>
}
