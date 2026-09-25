/**
 * Purpose: Explain single-tab browser ownership and offer a return-to-owner action.
 * Pattern: Access-blocked page.
 * Usage: Rendered by src/ui/shell/client-root.tsx when the origin database is owned by another tab.
 * Related: src/ui/browser-storage/tab-ownership.ts, src/ui/i18n/messages/common.ts
 */
import { useState } from "react"
import { Button } from "@/ui/components/ui/button"
import { useLocaleText } from "@/ui/hooks/use-locale-text"
import { requestOwnerFocus } from "@/ui/browser-storage/tab-ownership"

export function BlockedTab({ unsupported = false, detail }: { unsupported?: boolean; detail?: string }) {
  const { t } = useLocaleText()
  const [requested, setRequested] = useState(false)
  return <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 px-6">
    <h1 className="text-xl font-semibold">{unsupported ? t.browserStorageUnavailable : t.tabAlreadyOpen}</h1>
    <p className="text-sm text-muted-foreground">{unsupported ? t.browserStorageUnavailableHelp : t.tabAlreadyOpenHelp}</p>
    {detail ? <p role="alert" className="break-words text-sm text-destructive">{detail}</p> : null}
    {!unsupported ? <Button onClick={() => { requestOwnerFocus(); setRequested(true) }}>{t.returnToSimulation}</Button> : null}
    {requested ? <p role="status" className="text-sm text-muted-foreground">{t.tabFocusFallback}</p> : null}
  </main>
}
