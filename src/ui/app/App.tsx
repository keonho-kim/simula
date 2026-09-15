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
import { StartScreen } from "@/ui/pages/start-screen"
import { TopCommandBar } from "@/ui/components/navigation/top-command-bar"
import type { ScenarioDraft } from "@/ui/types/scenario"
import { useLocaleText } from "@/ui/hooks/use-locale-text"
import { downloadExport } from "@/ui/api/download-export"
import { useRoundProgression } from "@/ui/hooks/use-round-progression"
import { useRunEventStream } from "@/ui/hooks/use-run-event-stream"

type ViewMode = "home" | "simulation" | "report"

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
const RunHistoryDialog = lazy(() =>
  import("@/ui/components/scenario/run-history-dialog").then((module) => ({ default: module.RunHistoryDialog }))
)
const SamplePickerDialog = lazy(() =>
  import("@/ui/components/scenario/sample-picker-dialog").then((module) => ({ default: module.SamplePickerDialog }))
)
const ScenarioPreviewDialog = lazy(() =>
  import("@/ui/components/scenario/scenario-preview-dialog").then((module) => ({ default: module.ScenarioPreviewDialog }))
)
const SettingsDialog = lazy(() =>
  import("@/ui/components/settings/settings-dialog").then((module) => ({ default: module.SettingsDialog }))
)
const SimulationStage = lazy(() =>
  import("@/ui/components/simulation/simulation-stage").then((module) => ({ default: module.SimulationStage }))
)
const StoryBuilderDialog = lazy(() =>
  import("@/ui/components/scenario/story-builder-dialog").then((module) => ({ default: module.StoryBuilderDialog }))
)

function App() {
  const { t, promptLanguage, languagePreference, setLanguagePreference } = useLocaleText()
  const queryClient = useQueryClient()
  const selectedRunId = useRunStore((state) => state.selectedRunId)
  const setSelectedRunId = useRunStore((state) => state.setSelectedRunId)
  const resetLiveState = useRunStore((state) => state.resetLiveState)
  const pushEvents = useRunStore((state) => state.pushEvents)
  const syncRunDetail = useRunStore((state) => state.syncRunDetail)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [initialSession] = useState(readRunSession)
  const [viewMode, setViewMode] = useState<ViewMode>(initialSession.viewMode ?? "home")
  const viewModeRef = useRef<ViewMode>(initialSession.viewMode ?? "home")
  const selectedRunIdRef = useRef<string | undefined>(undefined)
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false)
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const [selectedActorId, setSelectedActorId] = useState<string>()
  const [actorDetailOpen, setActorDetailOpen] = useState(false)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [reportConfirmRunId, setReportConfirmRunId] = useState<string>()
  const [scenarioPreviewOpen, setScenarioPreviewOpen] = useState(false)
  const { autoContinue, setAutoContinue, roundPromptIndex, roundAction, continueRound, cancelCurrentRun,
    resetRoundProgression, completed } = useRoundProgression(selectedRunId, t)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>({
    sourceName: "pasted-scenario.md",
    text: "",
    controls: { numCast: 6, allowAdditionalCast: true, actionsPerType: 3, maxRound: 8, fastMode: false, outputLength: "short" },
  })

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
      setScenarioPreviewOpen(false)
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
      setScenarioPreviewOpen(false)
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
    if (run?.status === "completed") {
      viewModeRef.current = "report"
      setViewMode("report")
    }
  }

  const startDraftRun = () => {
    if (!scenarioDraft.text.trim()) {
      return
    }
    startDraftMutation.mutate({
      sourceName: scenarioDraft.sourceName,
      text: scenarioDraft.text,
      controls: scenarioDraft.controls,
      language: promptLanguage,
    })
  }

  const loadScenarioFile = (file: File) => {
    void file.text().then((text) => {
      setScenarioDraft({
        ...scenarioDraft,
        sourceName: file.name,
        text,
      })
      setScenarioPreviewOpen(true)
    })
  }

  if (viewMode === "home") {
    return (
      <>
        <input
          ref={uploadInputRef}
          className="sr-only"
          type="file"
          accept=".md,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) {
              loadScenarioFile(file)
            }
          }}
        />
        <StartScreen
          t={t}
          languagePreference={languagePreference}
          promptLanguage={promptLanguage}
          onNewScenario={() => setStoryBuilderOpen(true)}
          onUploadScenario={() => uploadInputRef.current?.click()}
          onExampleScenario={() => setSamplePickerOpen(true)}
          onRunHistory={() => setRunHistoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onLanguagePreferenceChange={setLanguagePreference}
        />
        <Suspense fallback={null}>
          {storyBuilderOpen ? (
            <StoryBuilderDialog
              open={storyBuilderOpen}
              t={t}
              promptLanguage={promptLanguage}
              onOpenChange={setStoryBuilderOpen}
              onUseDraft={(text, controls) => {
                setScenarioDraft({ sourceName: "story-builder.md", text, controls })
                setScenarioPreviewOpen(true)
              }}
            />
          ) : null}
          {samplePickerOpen ? (
            <SamplePickerDialog
              open={samplePickerOpen}
              t={t}
              onOpenChange={setSamplePickerOpen}
              onLoadSample={(sample) => {
                setScenarioDraft({
                  sourceName: sample.name,
                  text: sample.text,
                  controls: sample.controls,
                })
                setScenarioPreviewOpen(true)
              }}
            />
          ) : null}
          {runHistoryOpen ? (
            <RunHistoryDialog
              open={runHistoryOpen}
              runs={runsQuery.data ?? []}
              t={t}
              onOpenChange={setRunHistoryOpen}
              onOpenRun={(runId) => {
                selectRun(runId)
                if (viewModeRef.current !== "report") {
                  viewModeRef.current = "simulation"
                  setViewMode("simulation")
                }
              }}
            />
          ) : null}
          {scenarioPreviewOpen ? (
            <ScenarioPreviewDialog
              open={scenarioPreviewOpen}
              draft={scenarioDraft}
              isStarting={isStarting}
              autoContinue={autoContinue}
              t={t}
              onOpenChange={setScenarioPreviewOpen}
              onDraftChange={setScenarioDraft}
              onAutoContinueChange={setAutoContinue}
              onOpenSettings={() => {
                setScenarioPreviewOpen(false)
                setSettingsOpen(true)
              }}
              onStart={startDraftRun}
            />
          ) : null}
          {settingsOpen ? <SettingsDialog open={settingsOpen} t={t} onOpenChange={setSettingsOpen} /> : null}
        </Suspense>
      </>
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
      <div className="mx-auto flex min-h-svh w-full max-w-[1720px] flex-col px-4 py-3 lg:px-6">
        <TopCommandBar
          selectedRunStatus={selectedRunStatus}
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
          <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
        {roundPromptIndex !== undefined ? (
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
