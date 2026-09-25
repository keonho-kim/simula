/**
 * Purpose: Offer run artifacts and accepted analytical snapshots from one report export menu.
 * Pattern: Feature control composition with read-only query state.
 * Usage: Rendered by ReportPage for the selected run or parent batch.
 * Related: src/ui/api-client/analytical-report.ts, src/ui/models/report/analytical-export.ts
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import type { AnalysisSubject } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { fetchAnalyticalExport, lookupAnalysis } from "@/ui/api-client/analytical-report"
import { downloadText } from "@/ui/api-client/download-export"
import { renderAnalyticalMarkdown } from "@/ui/models/report/analytical-export"
import { Button } from "@/ui/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/ui/dropdown-menu"

export function ReportExportMenu({ runId, subject, onRunExport, t }: {
  runId?: string; subject: AnalysisSubject; onRunExport: (kind: "json" | "jsonl" | "md") => void; t: UiTexts
}) {
  const query = useQuery({ queryKey: ["analysis", subject.kind, subject.id], queryFn: ({ signal }) => lookupAnalysis(subject, signal), enabled: !!runId, retry: false })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const available = !!query.data?.analysis?.report
  async function save(kind: "json" | "md") {
    const record = query.data?.analysis
    if (!record?.report) return
    setBusy(true); setFailed(false)
    try {
      const artifact = await fetchAnalyticalExport(record.id)
      const markdown = kind === "md"
      const body = markdown ? renderAnalyticalMarkdown(artifact, t) : JSON.stringify(artifact, null, 2)
      downloadText(body, `${record.id}.analysis.${kind}`, markdown ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8")
    } catch { setFailed(true) }
    finally { setBusy(false) }
  }
  return <div className="flex flex-col gap-1">
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={!runId || busy}>
      <DownloadIcon data-icon="inline-start" />{t.reportExport}
    </Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup>
      <DropdownMenuItem onSelect={() => onRunExport("json")}>{t.exportJson}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onRunExport("jsonl")}>{t.exportJsonl}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onRunExport("md")}>{t.exportMarkdown}</DropdownMenuItem>
      <DropdownMenuItem disabled={!available} onSelect={() => void save("json")}>{t.analysisExportJson}</DropdownMenuItem>
      <DropdownMenuItem disabled={!available} onSelect={() => void save("md")}>{t.analysisExportMarkdown}</DropdownMenuItem>
    </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
    {failed ? <p role="alert" className="text-xs text-destructive">{t.analysisExportStopped}</p> : null}
  </div>
}
