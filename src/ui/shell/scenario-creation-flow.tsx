/**
 * Purpose: Keep scenario work alive while transitioning between the input page and document analysis page.
 * Pattern: Workflow composition root.
 * Usage: Mounted by HomeView across home and document-analysis routes.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/pages/document-analysis-page.tsx
 */
import { useEffect, useRef } from "react"
import type { ComponentProps } from "react"
import { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { ScenarioInputPage } from "@/ui/pages/scenario-input-page"
import { DocumentAnalysisPage } from "@/ui/pages/document-analysis-page"

type ScenarioCreationFlowProps = Omit<ComponentProps<typeof DocumentAnalysisPage>, "workflow"> & {
  autoExecute?: boolean
  active: boolean
  analysis: boolean
  onClose: () => void
  onAnalyze: () => void
}
export function ScenarioCreationFlow({ autoExecute, active, analysis, onClose, onAnalyze, ...props }: ScenarioCreationFlowProps) {
  const workflow = useDocumentScenario(active || analysis, props.language)
  const executed = useRef(false)
  useEffect(() => {
    if (!autoExecute || executed.current || !workflow.hydrated || workflow.busy || workflow.error) return
    executed.current = true
    void workflow.execute(onAnalyze)
  }, [autoExecute, workflow, onAnalyze])
  useEffect(() => {
    if (active && !analysis && (workflow.build || workflow.pendingGeneration)) onAnalyze()
  }, [active, analysis, workflow.build, workflow.pendingGeneration, onAnalyze])
  if (analysis) return <DocumentAnalysisPage {...props} workflow={workflow} />
  return <ScenarioInputPage active={active} workflow={workflow} t={props.t} onOpenSettings={props.onOpenSettings}
    onBack={onClose} onExecute={onAnalyze} />
}
