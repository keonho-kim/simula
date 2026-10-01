/**
 * Purpose: Review a finished scenario with readable source and launch controls.
 * Pattern: Page composition with draft protection.
 * Usage: Lazy-loaded by src/ui/shell/App.tsx before run creation.
 * Related: src/ui/shell/home-view.tsx, src/ui/browser-storage/database/drafts/save.ts
 */
import { useEffect, useState } from "react"
import { ArrowLeftIcon } from "lucide-react"
import type { ScenarioDraft } from "@/ui/types/scenario"
import type { UiTexts } from "@/ui/types/i18n"
import { Button } from "@/ui/components/ui/button"
import { UnsavedChangesDialog } from "@/ui/components/ui/unsaved-changes-dialog"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { WorkspaceFrame, WorkspaceHeader } from "@/ui/components/layout/workspace-frame"
import { ScenarioPreviewControls } from "@/ui/components/scenario/scenario-preview-controls"
import { validMultiverse } from "@/ui/models/scenario-builder/launch-options"
import { discardWorkingDraft } from "@/ui/browser-storage/database/drafts/discard-working"
import { writeWorkingDraft } from "@/ui/browser-storage/database/drafts/write-working"
import { saveDraft } from "@/ui/browser-storage/database/drafts/save"
import { usePageExit } from "@/ui/hooks/use-page-exit"
interface ScenarioPreviewPageProps {
  startError?: boolean
  open: boolean
  draft: ScenarioDraft
  isStarting: boolean
  autoContinue: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
  onDraftChange: (draft: ScenarioDraft) => void
  onAutoContinueChange: (autoContinue: boolean) => void
  onOpenSettings: () => void
  onStart: () => void
  onDraftSaved: () => void
}

export function ScenarioPreviewPage({
  startError,
  open,
  draft,
  isStarting,
  autoContinue,
  t,
  onOpenChange,
  onDraftChange,
  onAutoContinueChange,
  onOpenSettings,
  onStart,
  onDraftSaved,
}: ScenarioPreviewPageProps) {
  const canStart = draft.text.trim().length > 0 && draft.controls.numCast > 0 && validMultiverse(draft.multiverse)
  const [initial, setInitial] = useState(() => ({ draft, autoContinue }))
  const [confirmClose, setConfirmClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const dirty = JSON.stringify([draft, autoContinue]) !== JSON.stringify([initial.draft, initial.autoContinue])
  const { exit, cancelExit } = usePageExit(open, dirty, () => { setConfirmClose(true); setSaveError(undefined) }, saving || isStarting)
  const requestClose = () => {
    if (saving || isStarting) return
    if (dirty) { setConfirmClose(true); setSaveError(undefined); return }
    exit(() => onOpenChange(false))
  }
  const saveAndClose = async () => {
    setSaving(true); setSaveError(undefined)
    try {
      await saveDraft("finished-scenario", "scenario-preview", { draft, autoContinue })
      setInitial({ draft, autoContinue })
      onDraftSaved()
      setConfirmClose(false)
      exit(() => onOpenChange(false))
    } catch (error) { setSaveError(error instanceof Error ? error.message : t.builderRequestError) }
    finally { setSaving(false) }
  }

  const discardAndClose = async () => {
    setSaving(true)
    try {
      await discardWorkingDraft("finished-scenario")
      onDraftChange(initial.draft); onAutoContinueChange(initial.autoContinue)
      setConfirmClose(false); exit(() => onOpenChange(false))
    } catch { setSaveError(t.builderRequestError) }
    finally { setSaving(false) }
  }
  useEffect(() => {
    if (!open || !draft.text) return
    void writeWorkingDraft("finished-scenario", "scenario-preview", { draft, autoContinue }).catch(() => setSaveError(t.builderRequestError))
  }, [open, draft, autoContinue, t.builderRequestError])
  if (!open) return null
  return <>
    <WorkspaceFrame ariaLabel={t.scenarioPreview}>
      <WorkspaceHeader title={t.scenarioPreview} description={t.scenarioPreviewDescription}
        navigation={<Button variant="ghost" size="icon" aria-label={t.workspaceBack} onClick={requestClose}><ArrowLeftIcon /></Button>} />
      {draft.text ? <div className="workspace-split workspace-preview">
        <section className="workspace-panel"><h2 className="workspace-panel-title">{t.scenarioText}</h2>
          <p className="my-3 break-all text-xs text-muted-foreground">{draft.sourceName}</p><MarkdownContent content={draft.text} />
        </section>
        <section className="workspace-panel"><ScenarioPreviewControls draft={draft} onDraftChange={onDraftChange}
          autoContinue={autoContinue} onAutoContinueChange={onAutoContinueChange} isStarting={isStarting} startError={startError} t={t} /></section>
      </div> : <p role="status">{t.workspaceMissingPreview}</p>}
      {saveError ? <p role="alert" className="text-destructive">{saveError}</p> : null}
      <footer className="workspace-footer"><Button variant="outline" onClick={onOpenSettings}>{t.settings}</Button>
        <Button disabled={!canStart || isStarting} onClick={onStart}>{t.start}</Button></footer>
    </WorkspaceFrame>
    <UnsavedChangesDialog open={confirmClose} busy={saving} error={saveError} t={t} onSave={() => void saveAndClose()}
      onDiscard={() => void discardAndClose()}
      onContinue={() => { cancelExit(); setConfirmClose(false) }} />
  </>
}
