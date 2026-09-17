import { lazy, Suspense, useCallback, useMemo, useState } from "react"
import type { SimulationState } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { useRunStore } from "@/ui/stores/run-store"
import { ReplayDock } from "@/ui/components/replay/replay-dock"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/components/ui/tabs"
import { buildReportAnalysisViewModel } from "@/ui/models/report/report-analysis-view-model"
import { RelationshipHeatmap, RoundEvolution, BehaviorRanking } from "./simulation-dynamics"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/ui/components/ui/select"
import { EmptyPanel } from "./presentation"

const GraphView = lazy(() =>
  import("@/ui/components/graph/graph-view").then((module) => ({ default: module.GraphView }))
)

export function ReportRelationshipPanel({ state, t }: { state?: SimulationState; t: UiTexts }) {
  const model = useMemo(() => buildReportAnalysisViewModel(state), [state])
  const timeline = useRunStore((store) => store.timeline)
  const replayIndex = useRunStore((store) => store.replayIndex)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const [selection, setSelection] = useState<{ kind: "actor" | "edge"; id: string }>()
  const selectActor = useCallback(
    (id: string | undefined) => setSelection(id ? { kind: "actor", id } : undefined),
    []
  )
  const selectEdge = useCallback(
    (id: string | undefined) => setSelection(id ? { kind: "edge", id } : undefined),
    []
  )
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const actor =
    selection?.kind === "actor" ? state?.actors.find((item) => item.id === selection.id) : undefined
  const edge = selection?.kind === "edge" ? frame?.edges.find((item) => item.id === selection.id) : undefined
  const actorName = (id: string) => state?.actors.find((item) => item.id === id)?.name ?? id
  const summary = model?.analysis.summary
  if (!model || !state) return <EmptyPanel title={t.noRunSelected} body={t.reportAnalysisNoRunDescription} />
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <dl className="flex flex-wrap gap-x-10 gap-y-3 border-b pb-4">
        {[
          [t.actors, state.actors.length],
          [t.interactions, model.analysis.network.summary.validActionCount],
          [
            t.reportBriefingCompletedEvents,
            `${summary?.completedEventCount ?? 0} / ${summary?.totalEventCount ?? 0}`
          ]
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <Tabs defaultValue="graph">
        <TabsList>
          <TabsTrigger value="graph">{t.reportGraph}</TabsTrigger>
          <TabsTrigger value="heatmap">{t.relationshipHeatmap}</TabsTrigger>
        </TabsList>
        <TabsContent value="graph">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="h-[520px]">
                <Suspense fallback={<p role="status">{t.reportLoading}</p>}>
                  <GraphView
                    frame={frame}
                    actors={state.actors}
                    t={t}
                    selectedActorId={selection?.kind === "actor" ? selection.id : undefined}
                    selectedEdgeId={selection?.kind === "edge" ? selection.id : undefined}
                    onActorSelect={selectActor}
                    onEdgeSelect={selectEdge}
                  />
                </Suspense>
              </div>
              <div className="mt-3">
                <ReplayDock t={t} />
              </div>
            </div>
            <aside
              aria-label={t.reportRelationshipDetails}
              className="max-h-[640px] overflow-y-auto rounded-md border p-4"
            >
              <Select
                value={selection?.kind === "edge" ? selection.id : "none"}
                onValueChange={(id) => selectEdge(id === "none" ? undefined : id)}
              >
                <SelectTrigger aria-label={t.reportSelectEdge} className="mb-4 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">{t.reportSelectEdge}</SelectItem>
                    {frame?.edges.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {actorName(item.source)} → {actorName(item.target)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {actor ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-base font-semibold">{actor.name}</h2>
                    <p className="text-xs text-muted-foreground">{actor.role}</p>
                  </div>
                  {[
                    [t.reportPersonality, actor.personality],
                    [t.intent, frame?.nodes.find((node) => node.id === actor.id)?.intent ?? actor.intent],
                    [t.reportBackground, actor.backgroundHistory]
                  ].map(([label, content]) => (
                    <section key={label}>
                      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{label}</h3>
                      <MarkdownContent compact content={content ?? ""} fallback="—" />
                    </section>
                  ))}
                </div>
              ) : edge ? (
                <div className="flex flex-col gap-4">
                  <h2 className="text-sm font-semibold">
                    {actorName(edge.source)} → {actorName(edge.target)}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t.graphEdgeWeight}: {edge.weight} · {t.round} {edge.roundIndex}
                  </p>
                  <MarkdownContent compact content={edge.latestContent} fallback="—" />
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">{t.reportSelectRelationship}</p>
              )}
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="heatmap">
          <RelationshipHeatmap model={model} t={t} />
        </TabsContent>
      </Tabs>
      <details onToggle={(event) => setAnalysisOpen(event.currentTarget.open)} className="border-t pt-4">
        <summary className="cursor-pointer text-sm font-medium">{t.reportAdditionalAnalysis}</summary>
        {analysisOpen ? (
          <div className="mt-4 flex flex-col gap-4">
            <RoundEvolution model={model} t={t} />
            <BehaviorRanking model={model} t={t} />
          </div>
        ) : null}
      </details>
    </div>
  )
}
