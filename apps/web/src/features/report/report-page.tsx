import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ActivityIcon,
  BotIcon,
  FileTextIcon,
  HomeIcon,
  Maximize2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchRun } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"
import { ActorCardRail, ActorDetailDialog } from "@/widgets/actor-panel"
import { ReplayDock } from "@/widgets/replay-dock"
import { SimulationStage } from "@/widgets/simulation-stage"
import {
  buildActorOptions,
  buildReportTimeline,
  buildRoleDiagnostics,
  type ActorFilter,
  type ReportSystemRole,
} from "./report-view-model"
import { RoleDiagnosticsPanel } from "./report-page/role-diagnostics-panel"
import { TimelinePanel } from "./report-page/timeline-panel"
import { ExportButton } from "./report-page/ui"

interface ReportPageProps {
  selectedRunId?: string
  selectedRunStatus?: string
  t: UiTexts
  onHome: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}

export function ReportPage({ selectedRunId, selectedRunStatus, t, onHome, onExport }: ReportPageProps) {
  const [replayOpen, setReplayOpen] = useState(false)
  const [selectedActorId, setSelectedActorId] = useState<string>()
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all")
  const [systemRoleFilter, setSystemRoleFilter] = useState<ReportSystemRole>("planner")
  const liveEvents = useRunStore((state) => state.liveEvents)
  const storedRunState = useRunStore((state) => state.runState)
  const runQuery = useQuery({
    queryKey: ["runs", selectedRunId],
    queryFn: () => fetchRun(selectedRunId ?? ""),
    enabled: Boolean(selectedRunId),
    retry: 30,
    retryDelay: 500,
  })
  const runState = runQuery.data?.state ?? storedRunState
  const events = runQuery.data?.events ?? liveEvents
  const actorOptions = useMemo(() => buildActorOptions(runState), [runState])
  const timelineRounds = useMemo(() => buildReportTimeline(runState, actorFilter, t), [actorFilter, runState, t])
  const roleDiagnostics = useMemo(() => buildRoleDiagnostics(events, t), [events, t])
  const selectedRoleSummary = roleDiagnostics.summaries.find((summary) => summary.role === systemRoleFilter)
  const selectedRoleEvents = roleDiagnostics.events.filter((event) => event.role === systemRoleFilter)
  const finalReport = runState?.reportMarkdown
    ?? [...events].reverse().find((event) => event.type === "report.delta")?.content

  const selectActorFromTimeline = (actorId: string) => {
    setSelectedActorId(actorId)
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[1720px] flex-col gap-4 px-4 py-3 lg:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button aria-label={t.home} variant="ghost" size="icon" className="rounded-md" onClick={onHome}>
              <HomeIcon />
              <span className="sr-only">{t.home}</span>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-heading text-lg font-semibold tracking-normal">{t.report}</h1>
                {selectedRunStatus ? (
                  <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] uppercase tracking-normal">
                    {selectedRunStatus}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{selectedRunId ?? t.noRunSelected}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportButton label={t.exportJson} disabled={!selectedRunId} onClick={() => onExport("json")} />
            <ExportButton label={t.exportJsonl} disabled={!selectedRunId} onClick={() => onExport("jsonl")} />
            <ExportButton label={t.exportMarkdown} disabled={!selectedRunId} onClick={() => onExport("md")} />
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_520px] 2xl:grid-cols-[300px_minmax(0,1fr)_560px]">
          <ActorCardRail t={t} selectedActorId={selectedActorId} onActorSelect={setSelectedActorId} />

          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60">
            <Tabs defaultValue="timeline" className="min-h-0 flex-1 gap-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div>
                  <h2 className="font-heading text-sm font-semibold">{t.simulationEvents}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{t.simulationEventsDescription}</p>
                </div>
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="timeline" className="text-xs">
                    <ActivityIcon data-icon="inline-start" />
                    {t.timeline}
                  </TabsTrigger>
                  <TabsTrigger value="roles" className="text-xs">
                    <BotIcon data-icon="inline-start" />
                    {t.roles}
                  </TabsTrigger>
                  <TabsTrigger value="final" className="text-xs">
                    <FileTextIcon data-icon="inline-start" />
                    {t.final}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="timeline" className="min-h-0 overflow-hidden">
                <TimelinePanel
                  actorFilter={actorFilter}
                  actorOptions={actorOptions}
                  rounds={timelineRounds}
                  t={t}
                  onActorFilterChange={setActorFilter}
                  onActorSelect={selectActorFromTimeline}
                />
              </TabsContent>

              <TabsContent value="roles" className="min-h-0 overflow-hidden">
                <RoleDiagnosticsPanel
                  summaries={roleDiagnostics.summaries}
                  selectedRole={systemRoleFilter}
                  selectedSummary={selectedRoleSummary}
                  events={selectedRoleEvents}
                  t={t}
                  onRoleChange={setSystemRoleFilter}
                />
              </TabsContent>

              <TabsContent value="final" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-[calc(100svh-206px)] min-h-[520px] p-4">
                  <MarkdownContent content={finalReport} fallback={t.finalReportFallback} />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="flex min-h-0 flex-col gap-3">
            <SimulationStage
              className="min-h-[460px]"
              graphClassName="min-h-[300px]"
              t={t}
              selectedActorId={selectedActorId}
              onActorSelect={setSelectedActorId}
              actions={
                <Button aria-label={t.maximizeReplay} variant="ghost" size="icon" onClick={() => setReplayOpen(true)}>
                  <Maximize2Icon />
                </Button>
              }
            />
            <ReplayDock t={t} />
          </aside>
        </section>
      </div>

      <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
        <DialogContent className="max-h-[92svh] overflow-hidden sm:max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>{t.simulationReplay}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-3">
            <SimulationStage
              className="min-h-[70svh]"
              graphClassName="min-h-[58svh]"
              t={t}
              selectedActorId={selectedActorId}
              onActorSelect={setSelectedActorId}
            />
            <ReplayDock t={t} />
          </div>
        </DialogContent>
      </Dialog>
      <ActorDetailDialog t={t} actorId={selectedActorId} onOpenChange={(open) => !open && setSelectedActorId(undefined)} />
    </main>
  )
}
