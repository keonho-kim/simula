import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { RunEvent, ScenarioInput } from "@simula/shared"
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
  createRun,
  fetchExport,
  fetchRun,
  fetchRuns,
  startRun,
} from "@/lib/api"
import { useRunStore } from "@/store/run-store"
import { ActivityRail } from "@/widgets/activity-rail"
import { ActorCardRail, ActorDetailDialog } from "@/widgets/actor-panel"
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

const eventTypes: RunEvent["type"][] = [
  "run.started",
  "node.started",
  "node.completed",
  "node.failed",
  "model.message",
  "model.metrics",
  "actors.ready",
  "interaction.recorded",
  "actor.message",
  "round.completed",
  "graph.delta",
  "log",
  "report.delta",
  "run.completed",
  "run.failed",
]

type ViewMode = "home" | "simulation" | "report"

function App() {
  const { t, promptLanguage, languagePreference, setLanguagePreference } = useLocaleText()
  const queryClient = useQueryClient()
  const selectedRunId = useRunStore((state) => state.selectedRunId)
  const setSelectedRunId = useRunStore((state) => state.setSelectedRunId)
  const resetLiveState = useRunStore((state) => state.resetLiveState)
  const pushEvents = useRunStore((state) => state.pushEvents)
  const syncRunDetail = useRunStore((state) => state.syncRunDetail)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("home")
  const viewModeRef = useRef<ViewMode>("home")
  const selectedRunIdRef = useRef<string | undefined>(undefined)
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false)
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const [selectedActorId, setSelectedActorId] = useState<string>()
  const [reportConfirmRunId, setReportConfirmRunId] = useState<string>()
  const [scenarioPreviewOpen, setScenarioPreviewOpen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>({
    sourceName: "pasted-scenario.md",
    text: "",
    controls: { numCast: 6, allowAdditionalCast: true, actionsPerType: 3, maxRound: 8, fastMode: false, actorContextTokenBudget: 2000 },
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
      viewModeRef.current = "simulation"
      setViewMode("simulation")
      await startRun(run.id)
      return run
    },
    onSuccess: async () => {
      toast.success("Simulation started")
      setScenarioPreviewOpen(false)
      setViewMode("simulation")
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Run failed"),
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
    if (!selectedRunId) {
      return
    }
    resetLiveState()
    const source = new EventSource(`/api/runs/${selectedRunId}/events`)
    const queuedEvents: RunEvent[] = []
    let scheduledFrame: number | undefined
    const flushEvents = () => {
      scheduledFrame = undefined
      const events = queuedEvents.splice(0)
      if (events.length) {
        pushEvents(events)
      }
    }
    const listeners = eventTypes.map((type) => {
      const listener = (message: MessageEvent<string>) => {
        const event = JSON.parse(message.data) as RunEvent
        queuedEvents.push(event)
        scheduledFrame ??= window.requestAnimationFrame(flushEvents)
        if (
          event.type === "run.completed" &&
          event.runId === selectedRunIdRef.current &&
          viewModeRef.current === "simulation"
        ) {
          setReportConfirmRunId(event.runId)
        }
        if (event.type === "run.completed" || event.type === "run.failed") {
          void queryClient.invalidateQueries({ queryKey: ["runs"] })
          void queryClient.invalidateQueries({ queryKey: ["runs", selectedRunId] })
        }
      }
      source.addEventListener(type, listener)
      return { type, listener }
    })
    source.onerror = () => {
      source.close()
    }
    return () => {
      for (const item of listeners) {
        source.removeEventListener(item.type, item.listener)
      }
      if (scheduledFrame !== undefined) {
        window.cancelAnimationFrame(scheduledFrame)
      }
      source.close()
    }
  }, [pushEvents, queryClient, resetLiveState, selectedRunId])

  const selectedRun = runsQuery.data?.find((run) => run.id === selectedRunId)
  const selectedRunStatus = selectedRunQuery.data?.run.status ?? selectedRun?.status
  const isStarting = startDraftMutation.isPending

  const downloadSelectedExport = (kind: "json" | "jsonl" | "md") => {
    if (!selectedRunId) {
      return
    }
    void downloadExport(selectedRunId, kind)
  }
  const selectActor = useCallback((actorId: string | undefined) => {
    setSelectedActorId(actorId)
  }, [])

  const selectRun = (runId: string | undefined) => {
    selectedRunIdRef.current = runId
    setSelectedActorId(undefined)
    setReportConfirmRunId(undefined)
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
          t={t}
          onOpenChange={setScenarioPreviewOpen}
          onDraftChange={setScenarioDraft}
          onOpenSettings={() => setSettingsOpen(true)}
          onStart={startDraftRun}
        />
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
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
          t={t}
          onHome={() => {
            setReportConfirmRunId(undefined)
            viewModeRef.current = "home"
            setViewMode("home")
          }}
        />

        <section className="grid min-h-0 flex-1 gap-4 py-4 xl:grid-cols-[260px_minmax(0,1fr)_340px] 2xl:grid-cols-[300px_minmax(0,1fr)_380px]">
          <ActorCardRail selectedActorId={selectedActorId} onActorSelect={setSelectedActorId} />
          <SimulationStage selectedActorId={selectedActorId} onActorSelect={selectActor} />
          <ActivityRail />
        </section>

        <ReplayDock />
        <ActorDetailDialog actorId={selectedActorId} onOpenChange={(open) => !open && setSelectedActorId(undefined)} />
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
      </div>
    </main>
  )
}

async function downloadExport(runId: string, kind: "json" | "jsonl" | "md") {
  const body = await fetchExport(runId, kind)
  const blob = new Blob([body], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${runId}.${kind}`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default App
