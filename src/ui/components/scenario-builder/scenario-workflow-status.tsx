/**
 * Purpose: Render shared loading and actionable errors for scenario setup and analysis.
 * Pattern: Presentational component.
 * Usage: Composed by the setup dialog and document analysis page.
 * Related: src/ui/hooks/use-document-scenario.ts
 */
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import type { UiTexts } from "@/ui/types/i18n"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"

export function ScenarioWorkflowStatus({ workflow: w, t }: { workflow: Pick<ReturnType<typeof useDocumentScenario>, "error" | "refreshing" | "refresh">; t: UiTexts }) {
  return <>
    {w.error ? <Alert variant="destructive"><AlertDescription>{w.error === "files" ? t.builderFileError : w.error === "participants" ? t.builderParticipantError : w.error === "extraction" ? t.builderReadFailedHelp : w.error === "storage" ? t.builderStorageFailed : t.builderRequestError}</AlertDescription>
      {w.error === "request" ? <Button variant="outline" size="sm" onClick={w.refresh}>{t.builderRefresh}</Button> : null}
    </Alert> : null}
    {w.refreshing ? <p role="status" className="text-sm text-muted-foreground">{t.builderLoading}</p> : null}
  </>
}
