import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ScenarioInput } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  cancelRun,
  continueRun,
  createRun,
  fetchRun,
  fetchRuns,
  startRun,
} from "@/lib/api"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useRunStore } from "@/store/run-store"
import { ActorDetailDialog } from "@/widgets/actor-panel"
import { ActivityRail } from "@/widgets/activity-rail"
import { EdgeDetailDialog } from "@/widgets/graph-view/edge-detail-dialog"
import { LlmMetricsPanel } from "@/widgets/llm-metrics-panel"
import { ReplayDock } from "@/widgets/replay-dock"
import { SimulationStage } from "@/widgets/simulation-stage"
import { StartScreen } from "@/widgets/start-screen"
import { TopCommandBar } from "@/widgets/top-command-bar"
import { ReportPage } from "@/features/report/report-page"
import { RunHistoryDialog } from "@/features/scenario/run-history-dialog"
import { SamplePickerDialog } from "@/features/scenario/sample-picker-dialog"
import {
  ScenarioPreviewDialog,
  type ScenarioDraft,
} from "@/features/scenario/scenario-preview-dialog"
import { StoryBuilderDialog } from "@/features/scenario/story-builder-dialog"
import { SettingsDialog } from "@/features/settings/settings-dialog"
import { useLocaleText } from "@/lib/i18n"
import { downloadExport } from "./download-export"
import { nextRoundContinuation } from "./round-continuation"
import { useRunEventStream } from "./use-run-event-stream"

type ViewMode = "home" | "simulation" | "report"

function App() {
  const { t, promptLanguage, languagePreference, setLanguagePreference } = useLocaleText()
  const queryClient = useQueryClient()
  const selectedRunId = useRunStore((state) => state.selectedRunId)
  const setSelectedRunId = useRunStore((state) => state.setSelectedRunId)
  const resetLiveState = useRunStore((state) => state.resetLiveState)
  const pushEvents = useRunStore((state) => state.pushEvents)
  const syncRunDetail = useRunStore((state) => state.syncRunDetail)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("home")
  const viewModeRef = useRef<ViewMode>("home")
  const selectedRunIdRef = useRef<string | undefined>(undefined)
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false)
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const [selectedActorId, setSelectedActorId] = useState<string>()
  const [actorDetailOpen, setActorDetailOpen] = useState(false)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>()
  const [reportConfirmRunId, setReportConfirmRunId] = useState<string>()
  const [scenarioPreviewOpen, setScenarioPreviewOpen] = useState(false)
  const [autoContinue, setAutoContinue] = useState(false)
  const [roundPromptIndex, setRoundPromptIndex] = useState<number>()
  const [roundAction, setRoundAction] = useState<"continue" | "cancel">()
  const [handledRoundIndexes, setHandledRoundIndexes] = useState<Set<number>>(new Set<number>())
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>({
    sourceName: "pasted-scenario.md",
    text: "",
    controls: { numCast: 6, allowAdditionalCast: true, actionsPerType: 3, maxRound: 8, fastMode: false, actorContextTokenBudget: 400, outputLength: "short" },
  })

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
      setRoundPromptIndex(undefined)
      setHandledRoundIndexes(new Set<number>())
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

  useEffect(() => {
    if (liveEvents.some((event) => event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled")) {
      setRoundPromptIndex(undefined)
    }
  }, [liveEvents])

  useRunEventStream({
    selectedRunId,
    selectedRunIdRef,
    viewModeRef,
    queryClient,
    resetLiveState,
    pushEvents,
    setReportConfirmRunId,
  })

  useEffect(() => {
    if (!selectedRunId || roundPromptIndex !== undefined) {
      return
    }
    const decision = nextRoundContinuation(liveEvents, handledRoundIndexes, autoContinue)
    if (!decision) {
      return
    }
    if (decision.mode === "prompt") {
      setRoundPromptIndex(decision.roundIndex)
      return
    }
    setHandledRoundIndexes((current) => new Set(current).add(decision.roundIndex))
    void continueRun(selectedRunId, decision.roundIndex).catch((error) => {
      toast.error(error instanceof Error ? error.message : t.roundContinueFailed)
    })
  }, [autoContinue, handledRoundIndexes, liveEvents, roundPromptIndex, selectedRunId, t.roundContinueFailed])

  const selectedRun = runsQuery.data?.find((run) => run.id === selectedRunId)
  const selectedRunStatus = selectedRunQuery.data?.run.status ?? selectedRun?.status
  const selectedRunCompleted =
    selectedRunStatus === "completed" ||
    liveEvents.some((event) => event.type === "run.completed" && event.runId === selectedRunId)
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
    setRoundPromptIndex(undefined)
    setHandledRoundIndexes(new Set<number>())
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

  const continueRound = async () => {
    if (!selectedRunId || roundPromptIndex === undefined) {
      return
    }
    const roundIndex = roundPromptIndex
    setRoundAction("continue")
    try {
      setHandledRoundIndexes((current) => new Set(current).add(roundIndex))
      setRoundPromptIndex(undefined)
      await continueRun(selectedRunId, roundIndex)
    } catch (error) {
      setHandledRoundIndexes((current) => {
        const next = new Set(current)
        next.delete(roundIndex)
        return next
      })
      setRoundPromptIndex(roundIndex)
      toast.error(error instanceof Error ? error.message : t.roundContinueFailed)
    } finally {
      setRoundAction(undefined)
    }
  }

  const cancelCurrentRun = async () => {
    if (!selectedRunId) {
      return
    }
    setRoundAction("cancel")
    try {
      await cancelRun(selectedRunId)
      setRoundPromptIndex(undefined)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.roundStopFailed)
    } finally {
      setRoundAction(undefined)
    }
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
        <SettingsDialog open={settingsOpen} t={t} onOpenChange={setSettingsOpen} />
      </>
    )
  }

  if (viewMode === "report") {
    return (
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
          <LlmMetricsPanel t={t} />
          <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <SimulationStage
              t={t}
              selectedActorId={selectedActorId}
              onActorSelect={selectActor}
              onActorExpand={expandActor}
              selectedEdgeId={selectedEdgeId}
              onEdgeSelect={selectEdge}
              showActorPopover
            />
            <ActivityRail t={t} />
          </section>
        </div>

        <ReplayDock t={t} />
        <ActorDetailDialog
          t={t}
          actorId={selectedActorId}
          open={actorDetailOpen}
          onOpenChange={(open) => setActorDetailOpen(open)}
        />
        <EdgeDetailDialog t={t} edgeId={selectedEdgeId} onOpenChange={(open) => !open && setSelectedEdgeId(undefined)} />
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
        <Dialog open={roundPromptIndex !== undefined} onOpenChange={() => undefined}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{t.roundContinueTitle}</DialogTitle>
              <DialogDescription>{t.roundContinueDescription}</DialogDescription>
            </DialogHeader>
            <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
              <Switch
                id="round-auto-continue"
                checked={autoContinue}
                onCheckedChange={setAutoContinue}
              />
              <FieldContent>
                <FieldLabel htmlFor="round-auto-continue">{t.autoContinue}</FieldLabel>
                <FieldDescription>{t.autoContinueHelp}</FieldDescription>
              </FieldContent>
            </Field>
            <DialogFooter className="sm:items-center">
              <Button
                variant="outline"
                disabled={Boolean(roundAction)}
                onClick={() => void cancelCurrentRun()}
              >
                {roundAction === "cancel" ? t.roundStopPending : t.roundStop}
              </Button>
              <Button
                disabled={Boolean(roundAction)}
                onClick={() => void continueRound()}
              >
                {roundAction === "continue" ? t.roundContinuePending : t.roundContinue}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}

export default App
