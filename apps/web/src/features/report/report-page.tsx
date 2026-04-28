import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DownloadIcon, HomeIcon, Maximize2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchReport } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"
import { ActorCardRail, ActorDetailDialog } from "@/widgets/actor-panel"
import { ReplayDock } from "@/widgets/replay-dock"
import { SimulationStage } from "@/widgets/simulation-stage"

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
  const liveEvents = useRunStore((state) => state.liveEvents)
  const liveReport = [...liveEvents].reverse().find((event) => event.type === "report.delta")?.content
  const reportQuery = useQuery({
    queryKey: ["report", selectedRunId],
    queryFn: () => fetchReport(selectedRunId ?? ""),
    enabled: Boolean(selectedRunId),
    retry: 30,
    retryDelay: 500,
  })

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
              <p className="mt-1 truncate text-xs text-muted-foreground">{selectedRunId ?? "No run selected"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExportButton label={t.exportJson} disabled={!selectedRunId} onClick={() => onExport("json")} />
            <ExportButton label={t.exportJsonl} disabled={!selectedRunId} onClick={() => onExport("jsonl")} />
            <ExportButton label={t.exportMarkdown} disabled={!selectedRunId} onClick={() => onExport("md")} />
          </div>
        </header>

        <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_520px] 2xl:grid-cols-[300px_minmax(0,1fr)_560px]">
          <ActorCardRail selectedActorId={selectedActorId} onActorSelect={setSelectedActorId} />

          <div className="flex min-h-0 flex-col rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="font-heading text-sm font-semibold">Markdown Report</h2>
              <p className="mt-1 text-xs text-muted-foreground">Final report and exportable run artifact.</p>
            </div>
            <ScrollArea className="min-h-[520px] flex-1 p-4">
              <MarkdownContent content={reportQuery.data ?? liveReport} fallback="Run finalization has not produced a report yet." />
            </ScrollArea>
          </div>

          <aside className="flex min-h-0 flex-col gap-3">
            <SimulationStage
              className="min-h-[460px]"
              graphClassName="min-h-[300px]"
              selectedActorId={selectedActorId}
              onActorSelect={setSelectedActorId}
              actions={
                <Button aria-label="Maximize replay" variant="ghost" size="icon" onClick={() => setReplayOpen(true)}>
                  <Maximize2Icon />
                </Button>
              }
            />
            <ReplayDock />
          </aside>
        </section>
      </div>

      <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
        <DialogContent className="max-h-[92svh] overflow-hidden sm:max-w-[1400px]">
          <DialogHeader>
            <DialogTitle>Simulation Replay</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-3">
            <SimulationStage
              className="min-h-[70svh]"
              graphClassName="min-h-[58svh]"
              selectedActorId={selectedActorId}
              onActorSelect={setSelectedActorId}
            />
            <ReplayDock />
          </div>
        </DialogContent>
      </Dialog>
      <ActorDetailDialog actorId={selectedActorId} onOpenChange={(open) => !open && setSelectedActorId(undefined)} />
    </main>
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
