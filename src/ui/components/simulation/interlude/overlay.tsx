import { memo, useEffect, useState } from "react"
import type { UiTexts } from "@/ui/types/i18n"
import type { InterludeStageId, InterludeStageStatus, SimulationInterludeState } from "@/ui/models/simulation/simulation-stage-interlude"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { Dialog, DialogContent, DialogTitle } from "@/ui/components/ui/dialog"
import { cn } from "@/ui/lib/class-names"

export const SimulationInterludeOverlay = memo(function SimulationInterludeOverlay({
  interlude,
  terminal,
  t,
}: {
  interlude?: SimulationInterludeState
  terminal: boolean
  t: UiTexts
}) {
  const [selectedStageId, setSelectedStageId] = useState<InterludeStageId | undefined>(interlude?.activeStageId)
  useEffect(() => {
    setSelectedStageId(interlude?.activeStageId)
  }, [interlude?.activeStageId])

  const visibleStageId = selectedStageId ?? interlude?.activeStageId
  const visibleStage = interlude?.stages.find((stage) => stage.id === visibleStageId)
  const details = interlude?.details.filter((item) => item.stageId === visibleStageId).slice(0, 4) ?? []
  const activeRound = terminal ? undefined : details.find((message) => message.roundIndex)?.roundIndex
  if (!interlude || terminal) {
    return null
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="flex h-[min(86svh,900px)] max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-border/70 bg-background/80 p-4 md:w-56 md:border-b-0 md:border-r">
            <DialogTitle>{t.interlude}</DialogTitle>
            <div className="mt-4 flex gap-1.5 overflow-x-auto md:flex-col">
              {interlude.stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className={cn(
                    "flex h-10 shrink-0 items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm transition-colors",
                    stage.id === visibleStageId && stage.status !== "active" && "bg-muted text-foreground ring-1 ring-border/70",
                    stage.status === "active" && "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100",
                    stage.status === "done" && stage.id !== visibleStageId && "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    stage.status === "waiting" && "text-muted-foreground/70"
                  )}
                  onClick={() => setSelectedStageId(stage.id)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", stageDotClass(stage.status))} />
                    <span className="truncate font-medium">{stage.label}</span>
                  </span>
                  {stage.status === "done" ? (
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">
                      {t.interludeStageDone}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{t.currentStep}</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{interlude.title}</h3>
              </div>
              {activeRound !== undefined ? (
                <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  R{activeRound}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InterludeMetric label={visibleStage?.label ?? interlude.roleLabel} value={selectedStageLabel(interlude, visibleStageId)} />
              <InterludeMetric label={t.actorCards} value={interlude.actorCardProgress ?? "0"} />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border border-border/70 bg-background/80 p-3">
              <div className="flex flex-col gap-3">
                {details.length ? details.map((item) => (
                  <article key={item.id} className="rounded-md border border-border/60 bg-card/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-foreground">{item.stepLabel}</h4>
                      </div>
                      {item.roundIndex !== undefined ? (
                        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          R{item.roundIndex}
                        </span>
                      ) : null}
                    </div>
                    <MarkdownContent compact className="mt-2 text-sm leading-6 text-foreground" content={item.message} fallback="" />
                  </article>
                )) : (
                  <article className="rounded-md border border-border/60 bg-card/80 p-3">
                    <h4 className="text-sm font-semibold text-foreground">{interlude.stepLabel}</h4>
                    <MarkdownContent compact className="mt-2 text-sm leading-6 text-foreground" content={interlude.message} fallback="" />
                  </article>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})

function InterludeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/80 px-3 py-2">
      <p className="truncate text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function selectedStageLabel(interlude: SimulationInterludeState, stageId: InterludeStageId | undefined): string {
  if (!stageId || stageId === interlude.activeStageId) {
    return interlude.stepLabel
  }
  const latestDetail = interlude.details.find((detail) => detail.stageId === stageId)
  return latestDetail?.stepLabel ?? interlude.stages.find((stage) => stage.id === stageId)?.status ?? "-"
}

function stageDotClass(status: InterludeStageStatus): string {
  if (status === "active") return "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]"
  if (status === "done") return "bg-muted-foreground/40"
  return "bg-border"
}
