/**
 * Purpose: Unlock browser credentials and confirm server synchronization before opening the app.
 * Pattern: Session entry gate.
 * Usage: Mounted by src/ui/shell/client-root.tsx when the encrypted credential vault exists.
 * Related: src/ui/browser-storage/database/credential-vault.ts, src/ui/api-client/client.ts
 */
import { useState, type ReactNode } from "react"
import { LockKeyholeIcon } from "lucide-react"
import "@/ui/styles/credential-gate.css"
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
    if (busy) return
    setBusy(true); setError(undefined)
    try {
      await unlockCredentialVault(passphrase)
      try { await syncActiveSettings() }
      catch { setError(t.settingsSyncFailed); return }
      setPassphrase("")
      setUnlocked(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : t.vaultUnlockFailed) }
    finally { setBusy(false) }
  }
  const reset = async () => {
    if (busy) return
    setBusy(true); setError(undefined)
    try {
      try { await clearActiveSettings() }
      catch { setError(t.settingsSyncFailed); return }
      await clearCredentialVault()
      setConfirmReset(false); setUnlocked(true)
    }
    catch (failure) { setError(failure instanceof Error ? failure.message : t.browserStorageUnavailable) }
    finally { setBusy(false) }
  }

  return <main className="credential-page">
    <section className="credential-card" aria-labelledby="credential-title">
      <div className="credential-brand"><LockKeyholeIcon aria-hidden="true" /><span>Simula</span></div>
      <header><h1 id="credential-title">{t.vaultUnlock}</h1><p id="credential-help">{t.vaultUnlockHelp}</p></header>
      <form aria-busy={busy} onSubmit={event => { event.preventDefault(); void unlock() }}>
        <label htmlFor="credential-passphrase">{t.vaultPassphrase}</label>
        <Input id="credential-passphrase" type="password" autoComplete="current-password" aria-describedby={error ? "credential-error credential-help" : "credential-help"}
          aria-invalid={Boolean(error)} disabled={busy} autoFocus value={passphrase} onChange={event => setPassphrase(event.target.value)} />
        {error ? <p id="credential-error" role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button disabled={busy || !passphrase} type="submit">{busy ? t.settingsLoading : t.vaultUnlock}</Button>
      </form>
      <footer><Button variant="link" disabled={busy} onClick={() => setConfirmReset(true)}>{t.vaultReset}</Button></footer>
    </section>
    <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
      <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
        <DialogTitle>{t.vaultReset}</DialogTitle>
        <DialogDescription>{t.vaultResetHelp}</DialogDescription>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setConfirmReset(false)}>{t.continueEditing}</Button>
          <Button variant="destructive" disabled={busy} onClick={() => void reset()}>{t.vaultReset}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </main>
}
