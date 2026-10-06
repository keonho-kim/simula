/**
 * Purpose: Manage simulation preparation and execution separately from source analysis.
 * Pattern: Workspace page composition.
 * Usage: Rendered by ScenarioCreationFlow at /simulations with its retained scenario workflow.
 * Related: src/ui/components/scenario-builder/world-launch.tsx, src/ui/styles/simulations.css
 */
import { useEffect, useRef } from "react"
import { FileTextIcon, SettingsIcon } from "lucide-react"
import { PageNavigation } from "@/ui/components/navigation/page-navigation"
import type { UiTexts } from "@/ui/types/i18n"
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { WorkspaceFrame, WorkspaceHeader } from "@/ui/components/layout/workspace-frame"
import { WorldLaunch } from "@/ui/components/scenario-builder/world-launch"
import { ScenarioWorkflowStatus } from "@/ui/components/scenario-builder/scenario-workflow-status"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import "@/ui/styles/simulations.css"

export function SimulationsPage({ workflow: w, t, language, onHome, onOpenSettings, onDocuments,
  starting, autoContinue, onAutoContinueChange, onStartWorld, onOpenRun }: {
  workflow: ReturnType<typeof useDocumentScenario>; t: UiTexts; language: "ko" | "en";
  onHome: () => void; onOpenSettings: () => void; onDocuments: () => void; starting: boolean;
  autoContinue: boolean; onAutoContinueChange: (enabled: boolean) => void;
  onStartWorld: (worldId: string) => void; onOpenRun: (runId: string, view?: "simulation" | "report") => void
}) {
  const page = useRef<HTMLDivElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
    page.current?.focus({ preventScroll: true })
  }, [])
  return <WorkspaceFrame ariaLabel={t.simulationsTitle}>
    <div ref={page} tabIndex={-1} className="outline-none">
      <WorkspaceHeader title={t.simulationsTitle}
        navigation={<PageNavigation kind="home" label={t.home} onClick={onHome} />}
        actions={<Button variant="outline" onClick={onOpenSettings}><SettingsIcon data-icon="inline-start" />{t.settings}</Button>} />
    </div>
    <ScenarioWorkflowStatus workflow={w} t={t} />
    {w.build?.status === "confirmed" ? <>
      <div className="simulation-source-context"><Badge variant="secondary">{t.builderConfirmed}</Badge>
        <p>{t.builderConfirmedHelp}</p><Button variant="link" onClick={onDocuments}><FileTextIcon data-icon="inline-start" />{t.simulationsReview}</Button>
      </div>
      <WorldLaunch key={w.build.id} scenarioId={w.build.id} fastMode={w.build.request.fastMode}
        initialOptions={w.form} open starting={starting} autoContinue={autoContinue} onAutoContinueChange={onAutoContinueChange}
        onStart={onStartWorld} onOpenRun={onOpenRun} language={language} t={t} />
    </> : !w.refreshing ? <section className="workspace-panel"><p>{t.simulationsEmpty}</p>
      <Button className="mt-4" onClick={onDocuments}>{t.simulationsReview}</Button></section> : null}
  </WorkspaceFrame>
}
