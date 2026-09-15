import { Alert, AlertDescription, AlertTitle } from "@/ui/components/ui/alert"
import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"
import type { LLMSettings } from "@/shared"
import { Button } from "@/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog"
import { ScrollArea } from "@/ui/components/ui/scroll-area"
import { fetchSettings, saveSettings } from "@/ui/api/client"
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
import type { ProviderJsonDraft, RoleJsonDraft, SettingsPage } from "@/ui/types/settings"

interface SettingsDialogProps {
  open: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, t, onOpenChange }: SettingsDialogProps) {
  const [draft, setDraft] = useState<LLMSettings | undefined>()
  const [page, setPage] = useState<SettingsPage>("providers")
  const [roleJsonDraft, setRoleJsonDraft] = useState<RoleJsonDraft>(() => emptyRoleJsonDraft())
  const [providerJsonDraft, setProviderJsonDraft] = useState<ProviderJsonDraft>(() => emptyProviderJsonDraft())
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings, enabled: open, retry: false })
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (settings) => {
      setDraft(settings)
      setRoleJsonDraft(buildRoleJsonDraft(settings))
      setProviderJsonDraft(buildProviderJsonDraft(settings))
      toast.success(t.settingsSavedToast)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.settingsSaveFailedToast),
  })

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    const next = structuredClone(settingsQuery.data)
    setDraft(next)
    setRoleJsonDraft(buildRoleJsonDraft(next))
    setProviderJsonDraft(buildProviderJsonDraft(next))
  }, [settingsQuery.data])

  const saveDraft = () => {
    if (!draft) {
      return
    }
    try {
      saveMutation.mutate(applyJsonDrafts(draft, roleJsonDraft, providerJsonDraft))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.settingsInvalidToast)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] gap-4 overflow-hidden sm:max-w-[1120px]">
        <DialogHeader>
          <DialogTitle>{t.settingsTitle}</DialogTitle>
          <DialogDescription>{t.settingsDescription}</DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="grid min-h-0 gap-4 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
            <SettingsSidebar page={page} t={t} onSelect={setPage} />
            <ScrollArea className="max-h-[58svh] pr-2 sm:pr-3 md:max-h-[66svh]">
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
            </ScrollArea>
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

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button disabled={!draft || saveMutation.isPending} onClick={saveDraft}>
            <SaveIcon data-icon="inline-start" />
            {t.settingsSave}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
