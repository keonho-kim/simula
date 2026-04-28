import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"
import type { LLMSettings } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchSettings, saveSettings } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import {
  applyJsonDrafts,
  buildProviderJsonDraft,
  buildRoleJsonDraft,
  emptyProviderJsonDraft,
  emptyRoleJsonDraft,
} from "./settings-dialog/json-draft"
import { ProvidersPage } from "./settings-dialog/providers-page"
import { RolesPage } from "./settings-dialog/roles-page"
import { SettingsSidebar } from "./settings-dialog/sidebar"
import type { ProviderJsonDraft, RoleJsonDraft, SettingsPage } from "./settings-dialog/types"

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
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings })
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
      <DialogContent className="max-h-[88svh] gap-4 overflow-hidden sm:max-w-[1120px]">
        <DialogHeader>
          <DialogTitle>{t.settingsTitle}</DialogTitle>
          <DialogDescription>{t.settingsDescription}</DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="grid min-h-0 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <SettingsSidebar page={page} t={t} onSelect={setPage} />
            <ScrollArea className="max-h-[66svh] pr-3">
              {page === "providers" ? (
                <ProvidersPage
                  settings={draft}
                  jsonDraft={providerJsonDraft}
                  t={t}
                  setDraft={setDraft}
                  setJsonDraft={setProviderJsonDraft}
                />
              ) : (
                <RolesPage
                  settings={draft}
                  t={t}
                  setDraft={setDraft}
                  jsonDraft={roleJsonDraft}
                  setJsonDraft={setRoleJsonDraft}
                />
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{t.settingsLoading}</div>
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
