/**
 * Purpose: Collect scenario files and options in a modal before opening the document analysis page.
 * Pattern: Modal workflow composition.
 * Usage: Mounted by src/ui/shell/scenario-creation-flow.tsx before execution.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/styles/document-builder.css
 */
import { useState } from "react"
import { SettingsIcon, XIcon } from "lucide-react"
import type { UiTexts } from "@/ui/types/i18n"
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { Button } from "@/ui/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/ui/dialog"
import { UnsavedChangesDialog } from "@/ui/components/ui/unsaved-changes-dialog"
import { ScenarioWorkflowStatus } from "./scenario-workflow-status"
import { DocumentScenarioForm } from "./document-scenario-form"
import "@/ui/styles/document-builder.css"

interface ScenarioBuilderDialogProps {
  active: boolean
  workflow: ReturnType<typeof useDocumentScenario>
  t: UiTexts
  onBack: () => void
  onOpenSettings: () => void
  onExecute: () => void
}

export function ScenarioBuilderDialog({ active, workflow: w, t, onBack, onOpenSettings, onExecute }: ScenarioBuilderDialogProps) {
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string>()
  const requestClose = () => {
    if (closing) return
    if (w.dirty) { setConfirmClose(true); setCloseError(undefined); return }
    onBack()
  }
  const finishClose = async (action: "save" | "discard") => {
    setClosing(true); setCloseError(undefined)
    try {
      if (action === "save") await w.saveLocalDraft()
      else await w.discardLocalDraft()
      setConfirmClose(false)
      onBack()
    } catch (error) { setCloseError(error instanceof Error ? error.message : t.builderStorageFailed) }
    finally { setClosing(false) }
  }

  return <><Dialog open={active} onOpenChange={open => { if (!open) requestClose() }}>
    <DialogContent className="scenario-builder-dialog" overlayClassName="bg-black/30 backdrop-blur-[2px]" showCloseButton={false}>
      <header className="flex items-start gap-4 border-b pb-5">
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle className="text-xl font-semibold">{t.newScenario}</DialogTitle>
          <DialogDescription>{t.documentScenarioDescription}</DialogDescription>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto shrink-0" aria-label={t.settings} onClick={onOpenSettings}><SettingsIcon /></Button>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label={t.builderClose} onClick={requestClose}><XIcon /></Button>
      </header>
      <div className="document-scenario-body">
        <ScenarioWorkflowStatus workflow={w} t={t} />
        <DocumentScenarioForm workflow={w} onExecute={onExecute} t={t} />
      </div>
    </DialogContent>
  </Dialog>
  <UnsavedChangesDialog open={confirmClose} busy={closing} error={closeError} t={t}
    onSave={() => void finishClose("save")} onDiscard={() => void finishClose("discard")} onContinue={() => setConfirmClose(false)} />
  </>
}
