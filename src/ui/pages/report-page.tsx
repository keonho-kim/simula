import { reportStatusLabel } from "@/ui/models/report/status-label"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DownloadIcon, HomeIcon } from "lucide-react"
import { Badge } from "@/ui/components/ui/badge"
import { Button } from "@/ui/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem
} from "@/ui/components/ui/dropdown-menu"
import { generateCommentary, fetchRun } from "@/ui/api/client"
import type { UiTexts } from "@/ui/types/i18n"
import { useRunStore } from "@/ui/stores/run-store"
import { ReportRelationshipPanel } from "@/ui/components/report/relationship-panel"
import { ReportConversationPanel } from "@/ui/components/report/conversation-panel"
import { ReportPerformancePanel } from "@/ui/components/report/performance-panel"

interface ReportPageProps {
  selectedRunId?: string
  selectedRunStatus?: string
  t: UiTexts
  onHome: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}

export function ReportPage({ selectedRunId, selectedRunStatus, t, onHome, onExport }: ReportPageProps) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState("relationships")
  const liveEvents = useRunStore((state) => state.liveEvents)
  const storedRunState = useRunStore((state) => state.runState)
  const query = useQuery({
    queryKey: ["runs", selectedRunId],
    queryFn: () => fetchRun(selectedRunId ?? ""),
    enabled: Boolean(selectedRunId),
    refetchInterval: query => query.state.data?.state?.reportCommentary?.status === "running" ? 2000 : false,
    retry: 2
  })
  const state = query.data?.state ?? (storedRunState?.runId === selectedRunId ? storedRunState : undefined)
  const events = query.data?.events ?? (state ? liveEvents : [])
  const generation = useMutation({ mutationFn: () => generateCommentary(selectedRunId ?? ""), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId] }) })
  const title = query.data?.run.scenarioName || state?.scenario.sourceName || t.report
  const status = query.data?.run.status ?? selectedRunStatus
  return (
    <main className="min-h-svh bg-white text-foreground">
      <div className="mx-auto flex w-[94vw] max-w-[1600px] flex-col gap-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button aria-label={t.home} variant="ghost" size="icon" onClick={onHome}>
              <HomeIcon />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{title}</h1>
              <p className="text-xs text-muted-foreground">{t.report}</p>
            </div>
            {status ? (
              <Badge variant={status === "failed" ? "destructive" : "secondary"}>
                {reportStatusLabel(status, t)}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={!state || state.reportCommentary?.status === "running" || generation.isPending} onClick={() => generation.mutate()}>{state?.reportCommentary?.status === "running" ? t.reportCommentaryRunning : t.reportGenerateCommentary}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!selectedRunId}>
                <DownloadIcon data-icon="inline-start" />
                {t.reportExport}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onExport("json")}>{t.exportJson}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onExport("jsonl")}>{t.exportJsonl}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onExport("md")}>{t.exportMarkdown}</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>
        {generation.isError ? <p role="alert" className="text-sm text-destructive">{t.reportCommentaryUnavailable}</p> : null}
        {query.isError ? (
          <div role="alert" className="text-sm text-destructive">
            {t.reportLoadError}{" "}
            <Button variant="link" onClick={() => void query.refetch()}>
              {t.reportRetryLoad}
            </Button>
          </div>
        ) : null}
        {query.isLoading && !state ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t.reportLoading}
          </p>
        ) : null}
        {query.data?.run.error ? (
          <p role="alert" className="text-sm text-destructive">
            {query.data.run.error}
          </p>
        ) : null}
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-5">
          <TabsList className="w-full">
            <TabsTrigger value="relationships">{t.reportRelations}</TabsTrigger>
            <TabsTrigger value="conversations">{t.reportConversations}</TabsTrigger>
            <TabsTrigger value="performance">{t.reportPerformance}</TabsTrigger>
          </TabsList>
          <TabsContent value="relationships">
            {tab === "relationships" ? <ReportRelationshipPanel state={state} t={t} /> : null}
          </TabsContent>
          <TabsContent value="conversations">
            {tab === "conversations" ? (
              <ReportConversationPanel key={selectedRunId} state={state} events={events} t={t} />
            ) : null}
          </TabsContent>
          <TabsContent value="performance">
            {tab === "performance" ? (
              <ReportPerformancePanel key={selectedRunId} events={events} t={t} />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
