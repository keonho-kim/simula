/**
 * Purpose: Separate analytical reading, recorded interactions, and execution details.
 * Pattern: Deferred report view composition.
 * Usage: Mounted by ReportPage for an accepted analysis.
 * Related: src/ui/components/report/analysis/report-tabs.tsx, src/ui/components/report/analysis/execution-details.tsx
 */
import { lazy, Suspense } from "react"
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import type { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs"
import { EmptyPanel } from "../presentation"
import { ReportReadingTabs, type ReportReadingTab } from "./report-tabs"

const ExecutionDetails = lazy(() => import("./execution-details").then(module => ({ default: module.ReportExecutionDetails })))
export function AnalysisResults({ analysis, events, language, additionalTabs = [], t }: {
  analysis: Pick<ReturnType<typeof useAnalyticalReport>, "record" | "query">
  events: RunEvent[]; language: "en" | "ko"; additionalTabs?: ReportReadingTab[]; t: UiTexts
}) {
  const { record, query } = analysis
  return <div className="flex min-w-0 flex-col gap-5">
    {query.isError ? <Alert variant="destructive"><AlertDescription>{t.reportLoadError}</AlertDescription></Alert> : null}
    {query.data?.freshness === "outdated" || query.data?.freshness === "unavailable" ? <Alert><AlertDescription>
      {query.data.freshness === "outdated" ? t.analysisOutdated : t.analysisSourceUnavailable}
    </AlertDescription></Alert> : null}
    {record && record.status !== "ready" ? <Alert><AlertDescription>{t.analysisPartial}</AlertDescription></Alert> : null}
    {record?.report ? <Tabs key={record.id} defaultValue="analysis" className="report-view-tabs">
      <TabsList variant="line" aria-label={t.analysisReportTabs}>
        <TabsTrigger value="analysis">{t.workspaceAnalysis}</TabsTrigger>
        {additionalTabs.length ? <TabsTrigger value="records">{t.workspaceRecords}</TabsTrigger> : null}
        <TabsTrigger value="execution">{t.workspaceExecution}</TabsTrigger>
      </TabsList>
      <TabsContent value="analysis"><ReportReadingTabs record={record} t={t} /></TabsContent>
      {additionalTabs.length ? <TabsContent value="records"><Tabs defaultValue={additionalTabs[0].id}>
        <TabsList className="h-auto flex-wrap" aria-label={t.workspaceRecords}>{additionalTabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.title}</TabsTrigger>)}</TabsList>
        {additionalTabs.map(tab => <TabsContent key={tab.id} value={tab.id}><section className="report-reading-supplement" aria-label={tab.title}>
          <h2 className="text-2xl font-semibold">{tab.title}</h2>{tab.content}
        </section></TabsContent>)}
      </Tabs></TabsContent> : null}
      <TabsContent value="execution"><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ExecutionDetails record={record} events={events} language={language} t={t} /></Suspense></TabsContent>
    </Tabs> : <EmptyPanel title={t.analysisEmpty} body={t.analysisEmptyBody} />}
  </div>
}
