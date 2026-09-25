/**
 * Purpose: Edit provider and role settings in a bounded popup with guarded closing.
 * Pattern: Controlled settings workflow.
 * Usage: Opened from the application home and scenario preview.
 * Related: src/ui/components/settings/sidebar.tsx, src/ui/components/ui/unsaved-changes-dialog.tsx
 */
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/ui/alert"
import { useEffect, useState } from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SaveIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import type { LLMSettings } from "@/shared"
import { Button } from "@/ui/components/ui/button"
import { Input } from "@/ui/components/ui/input"
import { UnsavedChangesDialog } from "@/ui/components/ui/unsaved-changes-dialog"
import { createCredentialVault, hasCredentialVault, readUnlockedSecrets, unlockCredentialVault } from "@/ui/browser-storage/database/credential-vault"
import { separateProviderSecrets } from "@/ui/browser-storage/database/settings/secrets"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog"
import { fetchSettings, saveSettings } from "@/ui/api-client/client"
import type { UiTexts } from "@/ui/types/i18n"
import {
  applyJsonDrafts,
  buildProviderJsonDraft,
  buildRoleJsonDraft,
  emptyProviderJsonDraft,
  emptyRoleJsonDraft,
} from "@/ui/models/settings/json-draft"
import { ProviderSettingsPanel } from "@/ui/components/settings/provider-settings-panel"
import { RoleSettingsPanel } from "@/ui/components/settings/role-settings-panel"
import { SettingsSidebar } from "@/ui/components/settings/sidebar"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"
import type { ProviderJsonDraft, RoleJsonDraft, SettingsPage } from "@/ui/types/settings"

interface SettingsDialogProps {
  open: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, t, onOpenChange }: SettingsDialogProps) {
  const reducedMotion = useReducedMotionPreference()
  const client = useQueryClient()
  const [draft, setDraft] = useState<LLMSettings | undefined>()
  const [page, setPage] = useState<SettingsPage>("providers")
  const [roleJsonDraft, setRoleJsonDraft] = useState<RoleJsonDraft>(() => emptyRoleJsonDraft())
  const [providerJsonDraft, setProviderJsonDraft] = useState<ProviderJsonDraft>(() => emptyProviderJsonDraft())
  const [saved, setSaved] = useState<string>()
  const [confirmClose, setConfirmClose] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const [vaultExists, setVaultExists] = useState<boolean>()
  const [vaultUnlocked, setVaultUnlocked] = useState(Boolean(readUnlockedSecrets()))
  const [passphrase, setPassphrase] = useState("")
  const [unlocking, setUnlocking] = useState(false)
  const [vaultError, setVaultError] = useState<string>()
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings, enabled: open, retry: false, refetchOnWindowFocus: false })
  const saveMutation = useMutation({
    mutationFn: async (settings: LLMSettings) => {
      if (vaultExists === false) {
        if (!passphrase) throw new Error(t.vaultPassphraseRequired)
        await createCredentialVault(passphrase, separateProviderSecrets(settings).secrets)
        setVaultExists(true)
        setVaultUnlocked(true)
      }
      if (!readUnlockedSecrets()) throw new Error(t.vaultUnlockRequired)
      return saveSettings(settings)
    },
    onSuccess: (settings) => {
      setDraft(settings)
      const role = buildRoleJsonDraft(settings), provider = buildProviderJsonDraft(settings)
      setRoleJsonDraft(role)
      setProviderJsonDraft(provider)
      setSaved(JSON.stringify([settings, role, provider]))
      setConfirmClose(false)
      setPassphrase("")
      toast.success(t.settingsSavedToast)
      onOpenChange(false)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t.settingsSaveFailedToast
      setSaveError(message)
      toast.error(message)
    },
  })

  useEffect(() => { void hasCredentialVault().then(setVaultExists).catch(error => {
    setVaultError(error instanceof Error ? error.message : t.browserStorageUnavailable)
  }) }, [t.browserStorageUnavailable])

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    const next = structuredClone(settingsQuery.data)
    setDraft(next)
    const role = buildRoleJsonDraft(next), provider = buildProviderJsonDraft(next)
    setRoleJsonDraft(role)
    setProviderJsonDraft(provider)
    setSaved(JSON.stringify([next, role, provider]))
  }, [settingsQuery.data])

  const dirty = Boolean(draft && saved && JSON.stringify([draft, roleJsonDraft, providerJsonDraft]) !== saved)
  const requestClose = () => {
    if (saveMutation.isPending) return
    if (dirty) { setConfirmClose(true); setSaveError(undefined); return }
    onOpenChange(false)
  }

  const saveDraft = () => {
    if (!draft) {
      return
    }
    try {
      saveMutation.mutate(applyJsonDrafts(draft, roleJsonDraft, providerJsonDraft))
    } catch (error) {
      const message = error instanceof Error ? error.message : t.settingsInvalidToast
      setSaveError(message)
      toast.error(message)
    }
  }

  const unlock = async () => {
    setUnlocking(true); setVaultError(undefined)
    try {
      await unlockCredentialVault(passphrase)
      setVaultUnlocked(true)
      setPassphrase("")
      await client.invalidateQueries({ queryKey: ["settings"] })
    } catch (error) { setVaultError(error instanceof Error ? error.message : t.vaultUnlockFailed) }
    finally { setUnlocking(false) }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={next => { if (!next) requestClose() }}>
      <DialogContent className="editing-popup editing-popup--settings" showCloseButton={false}>
        <DialogHeader className="flex-row items-start gap-4">
          <div className="flex min-w-0 flex-col gap-2"><DialogTitle>{t.settingsTitle}</DialogTitle>
          <DialogDescription>{t.settingsDescription}</DialogDescription></div>
          <Button variant="ghost" size="icon" className="ml-auto shrink-0" aria-label={t.modalClose} onClick={requestClose}><XIcon /></Button>
        </DialogHeader>

        {vaultExists && !vaultUnlocked ? <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm">{t.vaultUnlockHelp}</p>
          <Input type="password" aria-label={t.vaultPassphrase} value={passphrase} onChange={event => setPassphrase(event.target.value)} />
          {vaultError ? <p role="alert" className="text-sm text-destructive">{vaultError}</p> : null}
          <Button disabled={unlocking || !passphrase} onClick={() => void unlock()}>{t.vaultUnlock}</Button>
        </div> : draft ? (
          <div className="flex min-w-0 flex-col gap-4 md:flex-row">
            <div className="shrink-0 md:w-[220px]"><SettingsSidebar page={page} t={t} onSelect={setPage} /></div>
            <div className="min-w-0 flex-1"><AnimatePresence mode="wait" initial={false}>
              <m.div key={page} {...slidePresence(reducedMotion, "x", 6, -6, "quick")}>
              {page === "providers" ? (
                <ProviderSettingsPanel
                  settings={draft}
                  jsonDraft={providerJsonDraft}
                  t={t}
                  setDraft={setDraft}
                  setJsonDraft={setProviderJsonDraft}
                />
              ) : (
                <RoleSettingsPanel
                  settings={draft}
                  t={t}
                  setDraft={setDraft}
                  jsonDraft={roleJsonDraft}
                  setJsonDraft={setRoleJsonDraft}
                />
              )}
              </m.div>
            </AnimatePresence></div>
          </div>
        ) : settingsQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t.settingsLoadFailed}</AlertTitle>
            <AlertDescription>
              <p>{t.settingsLoadHint}</p>
              <p className="break-words">{settingsQuery.error.message}</p>
              <Button variant="outline" disabled={settingsQuery.isFetching} onClick={() => void settingsQuery.refetch()}>{t.settingsRetry}</Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div role="status" className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{t.settingsLoading}</div>
        )}

        {vaultExists === false ? <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{t.vaultCreateHelp}</p>
          <Input type="password" aria-label={t.vaultPassphrase} value={passphrase} onChange={event => setPassphrase(event.target.value)} />
        </div> : null}

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button disabled={!draft || saveMutation.isPending || vaultExists === undefined || (vaultExists && !vaultUnlocked)} onClick={saveDraft}>
            <SaveIcon data-icon="inline-start" />
            {t.settingsSave}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog open={confirmClose} busy={saveMutation.isPending} error={saveError} t={t}
      onSave={saveDraft} onDiscard={() => { setConfirmClose(false); onOpenChange(false) }} onContinue={() => setConfirmClose(false)} />
    </>
  )
}
