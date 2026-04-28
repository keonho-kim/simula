import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ActivityIcon,
  BotIcon,
  DownloadIcon,
  FileTextIcon,
  FilterIcon,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchRun } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"
import { ActorCardRail, ActorDetailDialog } from "@/widgets/actor-panel"
import { ReplayDock } from "@/widgets/replay-dock"
import { SimulationStage } from "@/widgets/simulation-stage"
import {
  REPORT_SYSTEM_ROLES,
  buildActorOptions,
  buildReportTimeline,
  buildRoleDiagnostics,
  roleLabel,
  type ActorFilter,
  type ReportTimelineItem,
  type ReportTimelineRound,
  type ReportSystemRole,
  type RoleDiagnosticEvent,
  type RoleDiagnosticSummary,
} from "./report-view-model"

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

function TimelinePanel({
  actorFilter,
  actorOptions,
  rounds,
  t,
  onActorFilterChange,
  onActorSelect,
}: {
  actorFilter: ActorFilter
  actorOptions: ReturnType<typeof buildActorOptions>
  rounds: ReportTimelineRound[]
  t: UiTexts
  onActorFilterChange: (actorId: ActorFilter) => void
  onActorSelect: (actorId: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FilterIcon className="size-4" />
          <span>{rounds.length} {t.rounds}</span>
        </div>
        <Select value={actorFilter} onValueChange={onActorFilterChange}>
          <SelectTrigger size="sm" className="w-[240px]">
            <SelectValue placeholder={t.filterByActor} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t.allActors}</SelectItem>
              {actorOptions.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="h-[calc(100svh-260px)] min-h-[520px] p-4">
        {rounds.length ? (
          <div className="flex flex-col gap-4 pr-3">
            {rounds.map((round) => (
              <TimelineRoundCard key={round.roundIndex} round={round} t={t} onActorSelect={onActorSelect} />
            ))}
          </div>
        ) : (
          <EmptyPanel title={t.noEventsMatch} body={t.noEventsMatchDescription} />
        )}
      </ScrollArea>
    </div>
  )
}

function TimelineRoundCard({
  round,
  t,
  onActorSelect,
}: {
  round: ReportTimelineRound
  t: UiTexts
  onActorSelect: (actorId: string) => void
}) {
  return (
    <article className="rounded-md border border-border/70 bg-background/80">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-sm">{t.round} {round.roundIndex}</Badge>
            {round.elapsedTime ? <Badge variant="secondary" className="rounded-sm">{round.elapsedTime}</Badge> : null}
          </div>
          <h3 className="mt-2 font-heading text-sm font-semibold">{round.title}</h3>
          {round.summary ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{round.summary}</p> : null}
        </div>
        <Badge variant="outline" className="rounded-md">
          {round.interactions.length} {t.interactions}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {round.preRound || round.afterRound ? (
          <div className="grid gap-3 md:grid-cols-2">
            {round.preRound ? <RoundNote label={t.preRound} value={round.preRound} /> : null}
            {round.afterRound ? <RoundNote label={t.afterRound} value={round.afterRound} /> : null}
          </div>
        ) : null}

        {round.interactions.length ? (
          <div className="flex flex-col gap-2">
            {round.interactions.map((interaction) => (
              <InteractionCard key={interaction.id} interaction={interaction} t={t} onActorSelect={onActorSelect} />
            ))}
          </div>
        ) : (
          <EmptyPanel title={t.noAdoptedInteractions} body={t.noAdoptedInteractionsDescription} compact />
        )}

        <RoundList title={t.keyInteractions} items={round.keyInteractions} />
        <RoundList title={t.actorImpacts} items={round.actorImpacts} />
        <RoundList title={t.unresolvedQuestions} items={round.unresolvedQuestions} />
      </div>
    </article>
  )
}

function InteractionCard({
  interaction,
  t,
  onActorSelect,
}: {
  interaction: ReportTimelineItem
  t: UiTexts
  onActorSelect: (actorId: string) => void
}) {
  return (
    <article className="rounded-md bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ActorButton actorId={interaction.sourceActorId} label={interaction.sourceName} onActorSelect={onActorSelect} />
          {interaction.targetActorIds.length ? (
            <span className="text-xs text-muted-foreground">{t.interactionTo}</span>
          ) : null}
          {interaction.targetActorIds.map((actorId, index) => (
            <ActorButton
              key={actorId}
              actorId={actorId}
              label={interaction.targetNames[index] ?? actorId}
              onActorSelect={onActorSelect}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="rounded-sm">{interaction.visibility}</Badge>
          <Badge variant="secondary" className="rounded-sm">{interaction.decisionType}</Badge>
          <Badge variant="outline" className="rounded-sm">{interaction.actionType}</Badge>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6">{interaction.content}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MiniField label={t.intent} value={interaction.intent} />
        <MiniField label={t.expectation} value={interaction.expectation} />
      </div>
    </article>
  )
}

function RoleDiagnosticsPanel({
  summaries,
  selectedRole,
  selectedSummary,
  events,
  t,
  onRoleChange,
}: {
  summaries: RoleDiagnosticSummary[]
  selectedRole: ReportSystemRole
  selectedSummary?: RoleDiagnosticSummary
  events: RoleDiagnosticEvent[]
  t: UiTexts
  onRoleChange: (role: ReportSystemRole) => void
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h3 className="font-heading text-sm font-semibold">{t.systemRoleSignals}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t.systemRoleSignalsDescription}</p>
        </div>
        <Select value={selectedRole} onValueChange={(value) => onRoleChange(value as ReportSystemRole)}>
          <SelectTrigger size="sm" className="w-[220px]">
            <SelectValue placeholder={t.role} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {REPORT_SYSTEM_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roleLabel(role)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[calc(100svh-260px)] min-h-[520px] p-4">
        <div className="flex flex-col gap-4 pr-3">
          <div className="grid gap-3 md:grid-cols-3">
            {summaries.map((summary) => (
              <RoleSummaryCard key={summary.role} summary={summary} selected={summary.role === selectedRole} />
            ))}
          </div>

          {selectedSummary ? (
            <section className="rounded-md border border-border/70 bg-background/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-heading text-sm font-semibold">{selectedSummary.label}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedSummary.latestSignal}</p>
                </div>
                <Badge variant={selectedSummary.status === "failed" ? "destructive" : "secondary"} className="rounded-sm">
                  {selectedSummary.status}
                </Badge>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <MetricChip label={t.messages} value={selectedSummary.messageCount} />
                <MetricChip label={t.metrics} value={selectedSummary.metricCount} />
                <MetricChip label={t.nodes} value={selectedSummary.nodeEventCount} />
                <MetricChip label={t.logs} value={selectedSummary.logCount} />
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            {events.length ? (
              events.map((event) => <DiagnosticEventCard key={event.id} event={event} />)
            ) : (
              <EmptyPanel title={t.noRoleDiagnostics} body={t.noRoleDiagnosticsDescription} />
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}

function RoleSummaryCard({ summary, selected }: { summary: RoleDiagnosticSummary; selected: boolean }) {
  return (
    <div className={cn("rounded-md border bg-background/80 p-3", selected ? "border-foreground/20" : "border-border/70")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{summary.label}</span>
        <Badge variant={summary.status === "failed" ? "destructive" : "outline"} className="rounded-sm">
          {summary.status}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{summary.latestSignal}</p>
    </div>
  )
}

function DiagnosticEventCard({ event }: { event: RoleDiagnosticEvent }) {
  return (
    <article className="rounded-md border border-border/70 bg-background/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-sm">{event.kind}</Badge>
          <h4 className="text-xs font-semibold">{event.title}</h4>
        </div>
        <time className="font-mono text-[10px] text-muted-foreground">{timeLabel(event.timestamp)}</time>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{event.body}</p>
    </article>
  )
}

function RoundNote({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md bg-muted/25 p-3">
      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</h4>
      <p className="mt-1 text-xs leading-5">{value}</p>
    </section>
  )
}

function RoundList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null
  }
  return (
    <section className="rounded-md bg-muted/20 p-3">
      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</h4>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-5">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </section>
  )
}

function ActorButton({
  actorId,
  label,
  onActorSelect,
}: {
  actorId: string
  label: string
  onActorSelect: (actorId: string) => void
}) {
  return (
    <button
      type="button"
      className="max-w-[220px] truncate rounded-sm bg-background px-2 py-1 text-xs font-medium ring-1 ring-border/70 hover:ring-foreground/20"
      onClick={() => onActorSelect(actorId)}
    >
      {label}
    </button>
  )
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 p-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 text-xs leading-5">{value || "-"}</p>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold">{value.toLocaleString()}</div>
    </div>
  )
}

function EmptyPanel({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-md border border-dashed border-border/80 bg-muted/30 text-sm", compact ? "p-3" : "p-4")}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  )
}

function ExportButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" disabled={disabled} onClick={onClick}>
      <DownloadIcon data-icon="inline-start" />
      {label}
    </Button>
  )
}

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
