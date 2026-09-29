/**
 * Purpose: Keep scenario work alive while transitioning between the input modal and document analysis page.
 * Pattern: Workflow composition root.
 * Usage: Mounted by HomeView across home and document-analysis routes.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/pages/document-analysis-page.tsx
 */
import { useEffect } from "react"
import type { ComponentProps } from "react"
import { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { ScenarioBuilderDialog } from "@/ui/components/scenario-builder/scenario-builder-dialog"
import { DocumentAnalysisPage } from "@/ui/pages/document-analysis-page"

type ScenarioCreationFlowProps = Omit<ComponentProps<typeof DocumentAnalysisPage>, "workflow"> & {
  active: boolean
  analysis: boolean
  onClose: () => void
  onAnalyze: () => void
}
export function ScenarioCreationFlow({ active, analysis, onClose, onAnalyze, ...props }: ScenarioCreationFlowProps) {
  const workflow = useDocumentScenario(active || analysis, props.language)
  useEffect(() => {
    if (active && !analysis && (workflow.build || workflow.pendingGeneration)) onAnalyze()
  }, [active, analysis, workflow.build, workflow.pendingGeneration, onAnalyze])
  if (analysis) return <DocumentAnalysisPage {...props} workflow={workflow} />
  return <ScenarioBuilderDialog active={active} workflow={workflow} t={props.t} onOpenSettings={props.onOpenSettings}
    onBack={onClose} onExecute={onAnalyze} />
}
