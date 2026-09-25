/**
 * Purpose: Compose scenario setup, live generation, review, and world launch in one modal.
 * Pattern: Modal workflow composition.
 * Usage: Mounted by src/ui/shell/home-view.tsx when a new scenario is selected.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/styles/document-builder.css
 */
import { useState } from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { SettingsIcon, XIcon } from "lucide-react"
import type { PromptLanguage } from "@/shared/scenario"
import type { UiTexts } from "@/ui/types/i18n"
import { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/ui/dialog"
import { UnsavedChangesDialog } from "@/ui/components/ui/unsaved-changes-dialog"
import { DocumentScenarioForm } from "./document-scenario-form"
import { BuilderActivity } from "./builder-activity"
import { ScenarioReview } from "./scenario-review"
import { WorldLaunch } from "./world-launch"
import "@/ui/styles/document-builder.css"

interface ScenarioBuilderPageProps {
  active: boolean
  language: PromptLanguage
  t: UiTexts
  onBack: () => void
  onOpenSettings: () => void
  starting: boolean
  autoContinue: boolean
  onAutoContinueChange: (value: boolean) => void
  onStartWorld: (worldId: string) => void
  onOpenRun: (runId: string, view?: "simulation" | "report") => void
}

export function ScenarioBuilderDialog({ active, language, t, onBack, onOpenSettings, starting, autoContinue,
  onAutoContinueChange, onStartWorld, onOpenRun }: ScenarioBuilderPageProps) {
  const w = useDocumentScenario(active, language)
  const reducedMotion = useReducedMotionPreference()
  const running = w.build?.status === "running"
  const extracting = w.documents?.documents.some(document => document.status === "processing")
  const showFooter = w.hasSession || running || Boolean(w.build)
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string>()
  const stage = w.build?.status === "confirmed" ? "launch" : running ? "building"
    : w.build?.specification ? "review" : w.build ? "waiting" : "form"
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
    <DialogContent className="scenario-builder-dialog" showCloseButton={false}>
      <header className="flex items-start gap-4 border-b pb-5">
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle className="text-xl font-semibold">{t.newScenario}</DialogTitle>
          <DialogDescription>{t.documentScenarioDescription}</DialogDescription>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto shrink-0" aria-label={t.settings} onClick={onOpenSettings}><SettingsIcon /></Button>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label={t.builderClose} onClick={requestClose}><XIcon /></Button>
      </header>
      <div className="document-scenario-body">
        {w.error ? <Alert variant="destructive"><AlertDescription>{w.error === "files" ? t.builderFileError : w.error === "participants" ? t.builderParticipantError : w.error === "extraction" ? t.builderReadFailedHelp : w.error === "storage" ? t.builderStorageFailed : t.builderRequestError}</AlertDescription>
          {w.error === "request" ? <Button variant="outline" size="sm" onClick={w.refresh}>{t.builderRefresh}</Button> : null}
        </Alert> : null}
        {w.refreshing ? <p role="status" className="text-sm text-muted-foreground">{t.builderLoading}</p> : null}
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={stage} {...slidePresence(reducedMotion, "y", 6, -4)}>
            {w.build?.status === "confirmed" ? <WorldLaunch key={w.build.id} scenarioId={w.build.id} fastMode={w.build.request.fastMode} open={active} starting={starting} autoContinue={autoContinue} onAutoContinueChange={onAutoContinueChange} onStart={onStartWorld} onOpenRun={onOpenRun} language={language} t={t} /> : null}
            {running && w.build ? <BuilderActivity key={w.build.id} buildId={w.build.id} open={active} documents={w.documents} t={t} /> : w.build?.specification && stage === "review"
              ? <ScenarioReview specification={w.build.specification} documents={w.documents} t={t} />
              : !w.build ? <DocumentScenarioForm workflow={w} t={t} /> : null}
          </m.div>
        </AnimatePresence>
        {w.build?.status === "failed" || w.build?.status === "canceled" ? <Alert><AlertDescription>{w.build.status === "failed" ? t.builderRequestError : t.builderStatusCanceled}</AlertDescription></Alert> : null}
        {w.build?.status === "blocked" ? <Alert><AlertDescription>{t.builderBlockedHelp}</AlertDescription></Alert> : null}
        {w.build?.status === "confirmed" ? <Alert><AlertTitle>{t.builderConfirmed}</AlertTitle><AlertDescription>{t.builderConfirmedHelp}</AlertDescription></Alert> : null}
      </div>
      {showFooter ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {w.hasSession && !running ? <Button variant="ghost" disabled={w.busy || w.pendingGeneration || extracting} onClick={w.reset}>{t.builderNew}</Button> : null}
        {running ? <Button variant="outline" disabled={w.busy} onClick={() => void w.controlBuild("cancel")}>{t.builderCancel}</Button> : null}
        {w.build && ["failed", "canceled", "blocked"].includes(w.build.status) ? <Button disabled={w.busy} onClick={() => void w.controlBuild("retry")}>{t.builderRetry}</Button> : null}
        {w.build?.status === "review" ? <Button disabled={w.busy} onClick={() => void w.controlBuild("confirm")}>{t.builderConfirm}</Button> : null}
      </footer> : null}
    </DialogContent>
  </Dialog>
  <UnsavedChangesDialog open={confirmClose} busy={closing} error={closeError} t={t}
    onSave={() => void finishClose("save")} onDiscard={() => void finishClose("discard")} onContinue={() => setConfirmClose(false)} />
  </>
}
