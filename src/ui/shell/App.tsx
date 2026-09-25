/**
 * Purpose: Compose application views, selected-run lifecycle, and live event subscriptions.
 * Pattern: Composition root.
 * Usage: Mounted once by src/ui/shell/client-root.tsx.
 * Related: src/ui/animation/page-transition.tsx, src/ui/hooks/use-run-event-stream.ts
 */
import { usePageVisibility } from "@/ui/hooks/use-page-visibility"
import { readRunSession, updateRunSession } from "@/ui/browser-storage/run-session"
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ScenarioInput } from "@/shared"
import { ReportReadyDialog } from "@/ui/components/simulation/report-ready-dialog"
import {
  createRun,
  fetchRun,
  fetchRuns,
  startRun,
} from "@/ui/api-client/client"
import { RoundContinuationDialog } from "@/ui/components/simulation/round-continuation-dialog"
import { useRunStore } from "@/ui/stores/run-store"
import { TopCommandBar } from "@/ui/components/navigation/top-command-bar"
import { useLocaleText } from "@/ui/hooks/use-locale-text"
import { downloadExport } from "@/ui/api-client/download-export"
import { useRoundProgression } from "@/ui/hooks/use-round-progression"
import { useRunEventStream } from "@/ui/hooks/use-run-event-stream"
import { HomeView } from "@/ui/shell/home-view"
import { pathForView, viewFromPath, type ViewMode } from "@/ui/shell/browser-route"
import { PageTransition } from "@/ui/animation/page-transition"
import { useExitPresence } from "@/ui/animation/use-exit-presence"

const ScenarioBoard = lazy(() => import("@/ui/components/simulation/scenario-board").then(module => ({ default: module.ScenarioBoard })))

const ActorRail = lazy(() =>
  import("@/ui/components/actors/actor-rail").then((module) => ({ default: module.ActorRail }))
)
const ActorDetailDialog = lazy(() =>
  import("@/ui/components/actors/actor-panel").then((module) => ({ default: module.ActorDetailDialog }))
)
const EdgeDetailDialog = lazy(() =>
  import("@/ui/components/graph/edge-detail-dialog").then((module) => ({ default: module.EdgeDetailDialog }))
)
const LlmMetricsPanel = lazy(() =>
  import("@/ui/components/metrics/llm-metrics-panel").then((module) => ({ default: module.LlmMetricsPanel }))
)
const ReportPage = lazy(() =>
  import("@/ui/pages/report-page").then((module) => ({ default: module.ReportPage }))
)
const SimulationStage = lazy(() =>
  import("@/ui/components/simulation/simulation-stage").then((module) => ({ default: module.SimulationStage }))
)

function App() {
  usePageVisibility()
  const { t, promptLanguage, languagePreference, setLanguagePreference } = useLocaleText()
  const queryClient = useQueryClient()
  const selectedRunId = useRunStore((state) => state.selectedRunId)
  const setSelectedRunId = useRunStore((state) => state.setSelectedRunId)
  const resetLiveState = useRunStore((state) => state.resetLiveState)
  const pushEvents = useRunStore((state) => state.pushEvents)
  const syncRunDetail = useRunStore((state) => state.syncRunDetail)
  const [initialSession] = useState(() => ({ ...readRunSession(),
    ...viewFromPath(window.location.pathname, readRunSession()) }))
  const [viewMode, setViewMode] = useState<ViewMode>(initialSession.viewMode ?? "home")
  const viewModeRef = useRef<ViewMode>(initialSession.viewMode ?? "home")
  const selectedRunIdRef = useRef<string | undefined>(undefined)
  const [selectedActorId, setSelectedActorId] = useState<string>()
  const [actorDetailOpen, setActorDetailOpen] = useState(false)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [reportConfirmRunId, setReportConfirmRunId] = useState<string>()
  const actorDialogPresent = useExitPresence(actorDetailOpen)

  useEffect(() => {
    if (initialSession.runId) setSelectedRunId(initialSession.runId)
  }, [initialSession, setSelectedRunId])
  useEffect(() => {
    if (selectedRunId) updateRunSession({ runId: selectedRunId, viewMode })
  }, [selectedRunId, viewMode])
  useEffect(() => {
    const path = pathForView(viewMode, selectedRunId)
    if (path && window.location.pathname !== path) window.history.pushState(null, "", path)
  }, [viewMode, selectedRunId])
  useEffect(() => {
    const restore = () => {
      const route = viewFromPath(window.location.pathname, readRunSession())
      if (route.runId) setSelectedRunId(route.runId)
      viewModeRef.current = route.viewMode
      setViewMode(route.viewMode)
    }
    window.addEventListener("popstate", restore)
    return () => window.removeEventListener("popstate", restore)
  }, [setSelectedRunId])

  const runsQuery = useQuery({ queryKey: ["runs"], queryFn: fetchRuns })
  const selectedRunQuery = useQuery({
    queryKey: ["runs", selectedRunId],
    queryFn: () => fetchRun(selectedRunId ?? ""),
    enabled: viewMode !== "home" && Boolean(selectedRunId),
  })
  const managedByBatch = Boolean(selectedRunQuery.data?.run.batchId ?? runsQuery.data?.find(run => run.id === selectedRunId)?.batchId)
  const { autoContinue, setAutoContinue, skipRoundDelay, roundPromptIndex, roundAction, continueRound, cancelCurrentRun,
    resetRoundProgression, completed } = useRoundProgression(selectedRunId, t, managedByBatch)
  const roundDialogOpen = roundPromptIndex !== undefined && !skipRoundDelay
  const roundDialogPresent = useExitPresence(roundDialogOpen)
  const startDraftMutation = useMutation({
    mutationFn: async (input: ScenarioInput | { worldId: string }) => {
      const run = "worldId" in input
        ? await (await import("@/ui/api-client/worlds")).createWorldRun(input.worldId)
        : await createRun(input)
      selectedRunIdRef.current = run.id
      setSelectedRunId(run.id)
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
      setReportConfirmRunId(undefined)
      setSelectedActorId(undefined)
      setActorDetailOpen(false)
      setSelectedEdgeId(undefined)
      resetRoundProgression()
      const destination = ["completed", "failed", "canceled"].includes(run.status) ? "report" : "simulation"
      viewModeRef.current = destination
      setViewMode(destination)
      if (run.status === "created") await startRun(run.id)
      return run
    },
    onSuccess: async run => {
      if (run.status === "created") toast.success(t.simulationStartedToast)
      setViewMode(["completed", "failed", "canceled"].includes(run.status) ? "report" : "simulation")
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.runFailedToast),
  })

  useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId
  }, [selectedRunId])

  useEffect(() => {
    if (viewMode === "home" || !runsQuery.data?.length || selectedRunId) {
      return
    }
    setSelectedRunId(runsQuery.data[0]?.id)
  }, [runsQuery.data, selectedRunId, setSelectedRunId, viewMode])

  useRunEventStream({
    selectedRunId,
    selectedRunStatus: selectedRunQuery.data?.run.status ?? runsQuery.data?.find(run => run.id === selectedRunId)?.status,
    streamErrorText: t.runStreamUnavailable,
    selectedRunIdRef,
    viewModeRef,
    queryClient,
    resetLiveState,
    pushEvents,
    setReportConfirmRunId,
  })

  useEffect(() => {
    if (!selectedRunQuery.data) return
    syncRunDetail(selectedRunQuery.data.run, selectedRunQuery.data.timeline,
      selectedRunQuery.data.state, selectedRunQuery.data.events)
  }, [selectedRunQuery.data, syncRunDetail])

  const selectedRun = runsQuery.data?.find((run) => run.id === selectedRunId)
  const selectedRunStatus = selectedRunQuery.data?.run.status ?? selectedRun?.status
  const selectedRunCompleted =
    selectedRunStatus === "completed" ||
    completed
  const isStarting = startDraftMutation.isPending

  const downloadSelectedExport = (kind: "json" | "jsonl" | "md") => {
    if (!selectedRunId) {
      return
    }
    void downloadExport(selectedRunId, kind)
  }
  const selectActor = useCallback((actorId: string | undefined) => {
    setSelectedEdgeId(undefined)
    setSelectedActorId(actorId)
    if (!actorId) {
      setActorDetailOpen(false)
    }
  }, [])
  const expandActor = useCallback((actorId: string) => {
    setSelectedEdgeId(undefined)
    setSelectedActorId(actorId)
    setActorDetailOpen(true)
  }, [])
  const selectEdge = useCallback((edgeId: string | undefined) => {
    setActorDetailOpen(false)
    setSelectedActorId(undefined)
    setSelectedEdgeId(edgeId)
  }, [])

  const selectRun = (runId: string | undefined) => {
    selectedRunIdRef.current = runId
    setSelectedActorId(undefined)
    setActorDetailOpen(false)
    setSelectedEdgeId(undefined)
    setReportConfirmRunId(undefined)
    resetRoundProgression()
    setSelectedRunId(runId)
    const run = runsQuery.data?.find((item) => item.id === runId)
    if (run && ["completed", "failed", "canceled", "interrupted"].includes(run.status)) {
      viewModeRef.current = "report"
      setViewMode("report")
    }
  }

  let content: ReactNode
  if (viewMode === "home") {
    content = <HomeView
        t={t}
        languagePreference={languagePreference}
        promptLanguage={promptLanguage}
        runs={runsQuery.data ?? []}
        isStarting={isStarting}
        autoContinue={autoContinue}
        onAutoContinueChange={setAutoContinue}
        onLanguagePreferenceChange={setLanguagePreference}
        onStartScenario={(scenario) => startDraftMutation.mutate(scenario)}
        onStartWorld={worldId => startDraftMutation.mutate({ worldId })}
        onOpenRun={(runId, view) => {
          selectRun(runId)
          if (view) { viewModeRef.current = view; setViewMode(view); return }
          if (viewModeRef.current !== "report") {
            viewModeRef.current = "simulation"
            setViewMode("simulation")
          }
        }}
      />
  } else if (viewMode === "report") {
    content = <Suspense fallback={null}>
        <ReportPage
          selectedRunId={selectedRunId}
          selectedRunStatus={selectedRunStatus}
          language={promptLanguage}
          t={t}
          onHome={() => {
            setReportConfirmRunId(undefined)
            viewModeRef.current = "home"
            setViewMode("home")
          }}
          onExport={downloadSelectedExport}
        />
      </Suspense>
  } else {
    content = <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full flex-col px-4 py-3 lg:w-4/5 lg:px-0">
        <TopCommandBar
          selectedRunStatus={selectedRunStatus}
          autoContinue={autoContinue}
          onAutoContinueChange={managedByBatch ? undefined : setAutoContinue}
          autoContinueDisabled={Boolean(roundAction)}
          showReportShortcut={selectedRunCompleted}
          t={t}
          onHome={() => {
            setReportConfirmRunId(undefined)
            viewModeRef.current = "home"
            setViewMode("home")
          }}
          onReport={() => {
            setReportConfirmRunId(undefined)
            viewModeRef.current = "report"
            setViewMode("report")
          }}
        />

        {managedByBatch ? <p className="py-2 text-sm text-muted-foreground">{t.batchManagedNotice}</p> : null}
        <div className="flex min-h-0 flex-1 flex-col gap-4 py-4">
          <Suspense fallback={null}>
            <LlmMetricsPanel t={t} />
          </Suspense>
          <section className="flex min-h-0 flex-col items-start gap-4 xl:min-h-[720px] xl:flex-row">
            <Suspense fallback={null}>
              <SimulationStage
                className="min-h-[720px] w-full xl:flex-[3]"
                t={t}
                selectedActorId={selectedActorId}
                onActorSelect={selectActor}
                onActorExpand={expandActor}
                selectedEdgeId={selectedEdgeId}
                onEdgeSelect={selectEdge}
                showActorPopover
              />
              <ActorRail t={t} onActorSelect={expandActor} className="w-full xl:flex-[2]"
                overlayOpen={Boolean((reportConfirmRunId && reportConfirmRunId === selectedRunId) || (roundPromptIndex !== undefined && !skipRoundDelay))} />
            </Suspense>
          </section>
        </div>

        <Suspense fallback={null}>
          <ScenarioBoard key={selectedRunId} t={t} />
          {actorDialogPresent ? (
            <ActorDetailDialog
              t={t}
              actorId={selectedActorId}
              open={actorDetailOpen}
              onOpenChange={(open) => setActorDetailOpen(open)}
            />
          ) : null}
          {selectedEdgeId ? (
            <EdgeDetailDialog t={t} edgeId={selectedEdgeId} onOpenChange={(open) => !open && setSelectedEdgeId(undefined)} />
          ) : null}
        </Suspense>
        <ReportReadyDialog open={Boolean(reportConfirmRunId && reportConfirmRunId === selectedRunId)} t={t}
          onDismiss={() => setReportConfirmRunId(undefined)} onReport={() => {
            setReportConfirmRunId(undefined); viewModeRef.current = "report"; setViewMode("report")
          }} />
        {roundDialogPresent ? (
          <RoundContinuationDialog
            open={roundDialogOpen}
            autoContinue={autoContinue}
            action={roundAction}
            t={t}
            onAutoContinueChange={setAutoContinue}
            onContinue={continueRound}
            onCancel={cancelCurrentRun}
          />
        ) : null}
      </div>
    </main>
  }
  return <PageTransition viewKey={viewMode}>{content}</PageTransition>
}

export default App
