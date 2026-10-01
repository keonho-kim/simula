/**
 * Purpose: Collect source materials and scenario options in a guarded workspace.
 * Pattern: Page workflow composition.
 * Usage: Mounted by src/ui/shell/scenario-creation-flow.tsx before execution.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/styles/document-builder.css
 */
import { useState } from "react"
import { SettingsIcon, ArrowLeftIcon } from "lucide-react"
import type { UiTexts } from "@/ui/types/i18n"
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { Button } from "@/ui/components/ui/button"
import { WorkspaceFrame, WorkspaceHeader } from "@/ui/components/layout/workspace-frame"
import { usePageExit } from "@/ui/hooks/use-page-exit"
import { UnsavedChangesDialog } from "@/ui/components/ui/unsaved-changes-dialog"
import { ScenarioWorkflowStatus } from "@/ui/components/scenario-builder/scenario-workflow-status"
import { DocumentScenarioForm } from "@/ui/components/scenario-builder/document-scenario-form"
import "@/ui/styles/document-builder.css"

interface ScenarioInputPageProps {
  active: boolean
  workflow: ReturnType<typeof useDocumentScenario>
  t: UiTexts
  onBack: () => void
  onOpenSettings: () => void
  onExecute: () => void
}

export function ScenarioInputPage({ active, workflow: w, t, onBack, onOpenSettings, onExecute }: ScenarioInputPageProps) {
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string>()
  const { exit, cancelExit } = usePageExit(active, w.dirty, () => { setConfirmClose(true); setCloseError(undefined) }, closing)
  const requestClose = () => {
    if (closing) return
    if (w.dirty) { setConfirmClose(true); setCloseError(undefined); return }
    exit(onBack)
  }
  const finishClose = async (action: "save" | "discard") => {
    setClosing(true); setCloseError(undefined)
    try {
      if (action === "save") await w.saveLocalDraft()
      else await w.discardLocalDraft()
      setConfirmClose(false)
      exit(onBack)
    } catch (error) { setCloseError(error instanceof Error ? error.message : t.builderStorageFailed) }
    finally { setClosing(false) }
  }

  if (!active) return null
  return <><WorkspaceFrame ariaLabel={t.newScenario}>
      <WorkspaceHeader title={t.newScenario} description={t.documentScenarioDescription}
        navigation={<Button variant="ghost" size="icon" aria-label={t.workspaceBack} onClick={requestClose}><ArrowLeftIcon /></Button>}
        actions={<Button variant="outline" onClick={onOpenSettings}><SettingsIcon data-icon="inline-start" />{t.settings}</Button>} />
      <div className="document-scenario-body">
        <ScenarioWorkflowStatus workflow={w} t={t} />
        <DocumentScenarioForm workflow={w} onExecute={onExecute} t={t} />
      </div>
  </WorkspaceFrame>
  <UnsavedChangesDialog open={confirmClose} busy={closing} error={closeError} t={t}
    onSave={() => void finishClose("save")} onDiscard={() => void finishClose("discard")} onContinue={() => { cancelExit(); setConfirmClose(false) }} />
  </>
}
