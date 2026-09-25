/**
 * Purpose: Show startup feedback while claiming the tab and lazily opening browser storage.
 * Pattern: Browser composition root.
 * Usage: Dynamically loaded by src/app/client-app.tsx after hydration.
 * Related: src/ui/browser-storage/tab-ownership.ts, src/ui/browser-storage/database/connection.ts, src/ui/animation/provider.tsx
 */
"use client"

import { Suspense, lazy, useEffect, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@/ui/components/ui/tooltip"
import { Toaster } from "@/ui/components/ui/sonner"
import { BlockedTab } from "@/ui/pages/blocked-tab"
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

interface Startup { ownership: TabOwnership; lockedVault: boolean; storageError?: string }

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
    startBrowserPresence(() => { void queryClient.invalidateQueries({ queryKey: ["runs"] }) })
    return { ownership, lockedVault }
  } catch (error) {
    return { ownership, lockedVault: false, storageError: error instanceof Error ? error.message : "Browser storage failed." }
  }
}

let startup: Promise<Startup> | undefined

export default function ClientRoot() {
  const [state, setState] = useState<Startup>()
  const { t } = useLocaleText()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      startup ??= beginStartup()
      void startup.then(setState)
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  if (!state) return <main className="mx-auto flex min-h-svh max-w-[980px] flex-col justify-center px-5 text-center">
    <h1 className="font-heading text-4xl font-semibold sm:text-5xl">Simula</h1>
    <p role="status" className="mt-4 text-sm text-muted-foreground">{t.browserStorageOpening}</p>
  </main>
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">{t.browserStorageOpening}</p>}>
        {state.ownership === "owner" && !state.storageError ? <AnimationProvider>
          {state.lockedVault ? <CredentialGate><App /></CredentialGate> : <App />}
        </AnimationProvider>
          : <BlockedTab unsupported={state.ownership === "unsupported" || Boolean(state.storageError)} detail={state.storageError} />}
      </Suspense>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>
}
