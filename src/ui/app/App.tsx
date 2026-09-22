/**
 * Purpose: Compose application views, selected-run lifecycle, and live event subscriptions.
 * Pattern: Composition root.
 * Usage: Mounted once by src/ui/main.tsx.
 * Related: src/ui/app/home-view.tsx, src/ui/hooks/use-run-event-stream.ts
 */
import { usePageVisibility } from "@/ui/hooks/use-page-visibility"
import { readRunSession, updateRunSession } from "@/ui/storage/run-session"
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ScenarioInput } from "@/shared"
import { Button } from "@/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog"
import {
  createRun,
  fetchRun,
  fetchRuns,
  startRun,
} from "@/ui/api/client"
import { RoundContinuationDialog } from "@/ui/components/simulation/round-continuation-dialog"
import { useRunStore } from "@/ui/stores/run-store"
import { TopCommandBar } from "@/ui/components/navigation/top-command-bar"
import { useLocaleText } from "@/ui/hooks/use-locale-text"
import { downloadExport } from "@/ui/api/download-export"
import { useRoundProgression } from "@/ui/hooks/use-round-progression"
import { useRunEventStream } from "@/ui/hooks/use-run-event-stream"
import { HomeView } from "@/ui/app/home-view"

type ViewMode = "home" | "simulation" | "report"

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
  const [initialSession] = useState(readRunSession)
  const [viewMode, setViewMode] = useState<ViewMode>(initialSession.viewMode ?? "home")
  const viewModeRef = useRef<ViewMode>(initialSession.viewMode ?? "home")
  const selectedRunIdRef = useRef<string | undefined>(undefined)
  const [selectedActorId, setSelectedActorId] = useState<string>()
  const [actorDetailOpen, setActorDetailOpen] = useState(false)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [reportConfirmRunId, setReportConfirmRunId] = useState<string>()
  const { autoContinue, setAutoContinue, skipRoundDelay, roundPromptIndex, roundAction, continueRound, cancelCurrentRun,
    resetRoundProgression, completed } = useRoundProgression(selectedRunId, t)

  useEffect(() => {
    if (initialSession.runId) setSelectedRunId(initialSession.runId)
  }, [initialSession, setSelectedRunId])
  useEffect(() => {
    if (selectedRunId) updateRunSession({ runId: selectedRunId, viewMode })
  }, [selectedRunId, viewMode])

  const runsQuery = useQuery({ queryKey: ["runs"], queryFn: fetchRuns })
  const selectedRunQuery = useQuery({
    queryKey: ["runs", selectedRunId],
    queryFn: () => fetchRun(selectedRunId ?? ""),
    enabled: Boolean(selectedRunId),
  })
  const startDraftMutation = useMutation({
    mutationFn: async (scenario: ScenarioInput) => {
      const run = await createRun(scenario)
      selectedRunIdRef.current = run.id
      setSelectedRunId(run.id)
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
      setReportConfirmRunId(undefined)
      setSelectedActorId(undefined)
      setActorDetailOpen(false)
      setSelectedEdgeId(undefined)
      resetRoundProgression()
      viewModeRef.current = "simulation"
      setViewMode("simulation")
      await startRun(run.id)
      return run
    },
    onSuccess: async () => {
      toast.success(t.simulationStartedToast)
      setViewMode("simulation")
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
    if (!runsQuery.data?.length || selectedRunId) {
      return
    }
    setSelectedRunId(runsQuery.data[0]?.id)
  }, [runsQuery.data, selectedRunId, setSelectedRunId])

  useEffect(() => {
    if (!selectedRunQuery.data) {
      return
    }
    syncRunDetail(
      selectedRunQuery.data.run,
      selectedRunQuery.data.timeline,
      selectedRunQuery.data.state,
      selectedRunQuery.data.events
    )
  }, [selectedRunQuery.data, syncRunDetail])

  useRunEventStream({
    selectedRunId,
    selectedRunIdRef,
    viewModeRef,
    queryClient,
    resetLiveState,
    pushEvents,
    setReportConfirmRunId,
  })

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
    if (run && ["completed", "failed", "canceled"].includes(run.status)) {
      viewModeRef.current = "report"
      setViewMode("report")
    }
  }

  if (viewMode === "home") {
    return (
      <HomeView
        t={t}
        languagePreference={languagePreference}
        promptLanguage={promptLanguage}
        runs={runsQuery.data ?? []}
        isStarting={isStarting}
        autoContinue={autoContinue}
        onAutoContinueChange={setAutoContinue}
        onLanguagePreferenceChange={setLanguagePreference}
        onStartScenario={(scenario) => startDraftMutation.mutate(scenario)}
        onOpenRun={(runId) => {
          selectRun(runId)
          if (viewModeRef.current !== "report") {
            viewModeRef.current = "simulation"
            setViewMode("simulation")
          }
        }}
      />
    )
  }

  if (viewMode === "report") {
    return (
      <Suspense fallback={null}>
        <ReportPage
          selectedRunId={selectedRunId}
          selectedRunStatus={selectedRunStatus}
          t={t}
          onHome={() => {
            setReportConfirmRunId(undefined)
            viewModeRef.current = "home"
            setViewMode("home")
          }}
          onExport={downloadSelectedExport}
        />
      </Suspense>
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full flex-col px-4 py-3 lg:w-4/5 lg:px-0">
        <TopCommandBar
          selectedRunStatus={selectedRunStatus}
          autoContinue={autoContinue}
          onAutoContinueChange={setAutoContinue}
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

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 py-4">
          <Suspense fallback={null}>
            <LlmMetricsPanel t={t} />
          </Suspense>
          <section className="grid min-h-0 gap-4 xl:min-h-[720px] xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Suspense fallback={null}>
              <SimulationStage
                t={t}
                selectedActorId={selectedActorId}
                onActorSelect={selectActor}
                onActorExpand={expandActor}
                selectedEdgeId={selectedEdgeId}
                onEdgeSelect={selectEdge}
                showActorPopover
              />
              <ActorRail t={t} onActorSelect={expandActor} />
            </Suspense>
          </section>
        </div>

        <Suspense fallback={null}>
          <ScenarioBoard key={selectedRunId} t={t} />
          {actorDetailOpen ? (
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
        <Dialog
          open={Boolean(reportConfirmRunId && reportConfirmRunId === selectedRunId)}
          onOpenChange={(open) => {
            if (!open) {
              setReportConfirmRunId(undefined)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.reportConfirmTitle}</DialogTitle>
              <DialogDescription>{t.reportConfirmDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportConfirmRunId(undefined)}>
                {t.reportConfirmStay}
              </Button>
              <Button
                onClick={() => {
                  setReportConfirmRunId(undefined)
                  viewModeRef.current = "report"
                  setViewMode("report")
                }}
              >
                {t.reportConfirmOpen}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {roundPromptIndex !== undefined && !skipRoundDelay ? (
          <RoundContinuationDialog
            key={`${selectedRunId}:${roundPromptIndex}`}
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
  )
}

export default App
