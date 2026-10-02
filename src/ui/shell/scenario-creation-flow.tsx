/**
 * Purpose: Retain scenario workflow state across source analysis and simulation management pages.
 * Pattern: Workflow composition root with deferred execution workspace.
 * Usage: Mounted by HomeView across /scenario/new, /document-analysis, and /simulations.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/pages/simulations-page.tsx
 */
import { lazy, Suspense, useEffect, useRef, type ComponentProps } from "react"
import { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { ScenarioInputPage } from "@/ui/pages/scenario-input-page"
import { DocumentAnalysisPage } from "@/ui/pages/document-analysis-page"

const SimulationsPage = lazy(() => import("@/ui/pages/simulations-page").then(module => ({ default: module.SimulationsPage })))
type ScenarioCreationFlowProps = Omit<ComponentProps<typeof SimulationsPage>, "workflow"> & {
  autoExecute?: boolean; active: boolean; analysis: boolean; simulations: boolean;
  onClose: () => void; onAnalyze: () => void; onSimulations: () => void; onEdit: () => void
}
export function ScenarioCreationFlow({ autoExecute, active, analysis, simulations, onClose, onAnalyze, onSimulations, onEdit, ...props }: ScenarioCreationFlowProps) {
  const workflow = useDocumentScenario(active || analysis || simulations, props.language)
  const executed = useRef(false)
  const previousBuild = useRef<{ id: string; status: string } | undefined>(undefined)
  useEffect(() => {
    if (!autoExecute || executed.current || !workflow.hydrated || workflow.busy || workflow.error) return
    executed.current = true
    void workflow.execute(onAnalyze)
  }, [autoExecute, workflow, onAnalyze])
  useEffect(() => {
    const build = workflow.build
    if (active && (build || workflow.pendingGeneration)) {
      if (build?.status === "confirmed") onSimulations()
      else onAnalyze()
    }
    if (analysis && build?.status === "confirmed" && previousBuild.current?.id === build.id && previousBuild.current.status !== "confirmed") onSimulations()
    previousBuild.current = build ? { id: build.id, status: build.status } : undefined
  }, [active, analysis, workflow.build, workflow.pendingGeneration, onAnalyze, onSimulations])
  if (simulations) return <Suspense fallback={<p role="status">{props.t.builderLoading}</p>}><SimulationsPage {...props} workflow={workflow} /></Suspense>
  if (analysis) return <DocumentAnalysisPage workflow={workflow} t={props.t} onHome={props.onHome}
    onOpenSettings={props.onOpenSettings} onEdit={onEdit} onSimulations={onSimulations} />
  return <ScenarioInputPage active={active} workflow={workflow} t={props.t} onOpenSettings={props.onOpenSettings}
    onBack={onClose} onExecute={onAnalyze} />
}
