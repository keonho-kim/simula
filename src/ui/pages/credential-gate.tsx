/**
 * Purpose: Unlock browser-held provider credentials once before opening the app.
 * Pattern: Session entry gate.
 * Usage: Mounted by src/ui/shell/client-root.tsx when the encrypted credential vault exists.
 * Related: src/ui/browser-storage/database/credential-vault.ts, src/ui/api-client/client.ts
 */
import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/ui/components/ui/button"
import { Input } from "@/ui/components/ui/input"
import { useLocaleText } from "@/ui/hooks/use-locale-text"
import { clearCredentialVault, unlockCredentialVault } from "@/ui/browser-storage/database/credential-vault"
import { clearActiveSettings, syncActiveSettings } from "@/ui/api-client/client"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/ui/dialog"

export function CredentialGate({ children }: { children: ReactNode }) {
  const { t } = useLocaleText()
  const [unlocked, setUnlocked] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  if (unlocked) return children

  const unlock = async () => {
    setBusy(true); setError(undefined)
    try {
      await unlockCredentialVault(passphrase)
      setPassphrase("")
      await syncActiveSettings().catch(() => toast.error(t.settingsSyncFailed))
      setUnlocked(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : t.vaultUnlockFailed) }
    finally { setBusy(false) }
  }
  const reset = async () => {
    setBusy(true); setError(undefined)
    try { await clearCredentialVault(); await clearActiveSettings().catch(() => toast.error(t.settingsSyncFailed)); setConfirmReset(false); setUnlocked(true) }
    catch (failure) { setError(failure instanceof Error ? failure.message : t.browserStorageUnavailable) }
    finally { setBusy(false) }
  }

  return <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-5 px-6">
    <h1 className="text-xl font-semibold">{t.vaultUnlock}</h1>
    <p className="text-sm text-muted-foreground">{t.vaultUnlockHelp}</p>
    <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void unlock() }}>
      <Input type="password" aria-label={t.vaultPassphrase} autoFocus value={passphrase} onChange={event => setPassphrase(event.target.value)} />
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={busy || !passphrase} type="submit">{t.vaultUnlock}</Button>
    </form>
    <Button variant="ghost" onClick={() => setConfirmReset(true)}>{t.vaultReset}</Button>
    <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <DialogTitle>{t.vaultReset}</DialogTitle>
        <DialogDescription>{t.vaultResetHelp}</DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setConfirmReset(false)}>{t.continueEditing}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void reset()}>{t.vaultReset}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </main>
}
