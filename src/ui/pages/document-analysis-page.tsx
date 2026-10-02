/**
 * Purpose: Present document interpretation, scenario generation, cast review, and source-grounded scenario review.
 * Pattern: Page composition.
 * Usage: Mounted by ScenarioCreationFlow at /document-analysis before simulation management.
 * Related: src/ui/shell/scenario-creation-flow.tsx, src/ui/hooks/use-document-scenario.ts
 */
import { useEffect, useRef } from "react"
import * as m from "motion/react-m"
import { HomeIcon, SettingsIcon } from "lucide-react"
import type { UiTexts } from "@/ui/types/i18n"
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { fadePresence } from "@/ui/animation/presence"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/ui/alert"
import { BuilderActivity } from "@/ui/components/scenario-builder/builder-activity"
import { ScenarioReview } from "@/ui/components/scenario-builder/scenario-review"
import { ScenarioWorkflowStatus } from "@/ui/components/scenario-builder/scenario-workflow-status"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { scenarioSourceName } from "@/ui/models/scenario-builder/source-name"
import "@/ui/styles/document-builder.css"

export function DocumentAnalysisPage({ workflow: w, t, onHome, onOpenSettings, onEdit, onSimulations }: {
  workflow: ReturnType<typeof useDocumentScenario>; t: UiTexts;
  onHome: () => void; onOpenSettings: () => void; onEdit: () => void; onSimulations: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const reduced = useReducedMotionPreference()
  const running = w.build?.status === "running"
  const extracting = w.documents?.documents.some(document => document.status === "processing")
  const sourcesReady = w.documents?.documents.length && w.documents.documents.every(document => document.status === "ready" || document.status === "partial")
  const canResume = !w.build && (w.files.length > 0 || (!w.documents?.documents.length && !!w.form.context.trim())
    || (w.hasSession && !w.pendingGeneration && sourcesReady))
  const stage = running ? "building" : w.build?.specification ? "review" : "documents"
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); heading.current?.focus({ preventScroll: true }) }, [])
  return <main className="min-h-svh bg-background text-foreground">
    <div className="workspace-frame">
      <header className="flex items-center gap-3 border-b pb-4">
        <Button variant="ghost" size="icon" aria-label={t.home} onClick={onHome}><HomeIcon /></Button>
        <div className="min-w-0 flex-1"><h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">{t.documentAnalysisTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.documentAnalysisDescription}</p></div>
        <Button variant="ghost" size="icon" aria-label={t.settings} onClick={onOpenSettings}><SettingsIcon /></Button>
      </header>
      <ScenarioWorkflowStatus workflow={w} t={t} />
      <m.div key={stage} className="flex min-w-0 flex-col gap-4" {...fadePresence(reduced, "content")}>
        {stage === "documents" ? <section className="flex flex-col gap-3" aria-label={t.builderSourcesStage}>
          <h2 className="text-base font-semibold">{t.builderSourcesStage}</h2>
          <ul className="document-builder-files">
            {w.files.map((file, index) => <li key={`${file.name}-${index}`}><span className="min-w-0 flex-1 break-all">{file.name}</span><Badge variant="outline">{t.documentUploadPending}</Badge></li>)}
            {w.documents?.documents.map(document => <li key={document.id} className="flex-wrap">
              <span className="min-w-0 flex-1 break-all">{scenarioSourceName(document.name, t)}</span><Badge variant="outline">{builderLabel(document.status, t)}</Badge>
              {document.status === "processing" ? <Button variant="ghost" size="sm" disabled={w.busy} onClick={() => void w.controlFile(document.id, "cancel")}>{t.builderCancelReading}</Button> : null}
              {["uploaded", "failed", "canceled", "partial"].includes(document.status) ? <Button variant="outline" size="sm" disabled={w.busy} onClick={() => void w.controlFile(document.id, "extract")}>{t.builderReadAgain}</Button> : null}
            </li>)}
          </ul>
          {w.busy || w.pendingGeneration ? <p role="status" className="text-sm text-muted-foreground">{t.builderPreparing}</p> : null}
          {canResume ? <Button disabled={w.busy || !w.hydrated} onClick={() => void w.execute()}>{t.documentAnalysisResume}</Button> : null}
          {!w.hasSession && !w.files.length && !w.form.context.trim() && !w.busy && w.hydrated ? <Button variant="outline" onClick={onEdit}>{t.newScenario}</Button> : null}
        </section> : null}
        {running && w.build ? <BuilderActivity key={w.build.id} buildId={w.build.id} open documents={w.documents} t={t} /> : null}
        {stage === "review" && w.build?.specification ? <ScenarioReview specification={w.build.specification} documents={w.documents} t={t} /> : null}

      </m.div>
      {w.build && ["failed", "canceled", "blocked"].includes(w.build.status) ? <Alert><AlertDescription>{w.build.status === "blocked" ? t.builderBlockedHelp : w.build.status === "canceled" ? t.builderStatusCanceled : t.builderRequestError}</AlertDescription></Alert> : null}
      {w.build?.status === "confirmed" ? <Alert><AlertTitle>{t.builderConfirmed}</AlertTitle><AlertDescription>{t.builderConfirmedHelp}</AlertDescription></Alert> : null}
      <footer className="workspace-footer">
        {w.build?.status === "confirmed" ? <Button onClick={onSimulations}>{t.batchBackToWorlds}</Button> : null}
        {running ? <Button variant="destructive" disabled={w.busy} onClick={() => void w.controlBuild("cancel")}>{t.builderCancel}</Button> : null}
        {w.build && ["failed", "canceled", "blocked"].includes(w.build.status) ? <Button disabled={w.busy} onClick={() => void w.controlBuild("retry")}>{t.builderRetry}</Button> : null}
        {w.build?.status === "review" ? <Button disabled={w.busy} onClick={() => void w.controlBuild("confirm")}>{t.builderConfirm}</Button> : null}
        {w.hasSession && !running ? <Button variant="ghost" disabled={w.busy || w.pendingGeneration || extracting} onClick={() => { w.reset(); onEdit() }}>{t.builderNew}</Button> : null}
      </footer>
    </div>
  </main>
}
