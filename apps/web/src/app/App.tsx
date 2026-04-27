import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { RunEvent, ScenarioInput } from "@simula/shared"
import {
  createRun,
  fetchExport,
  fetchRun,
  fetchRuns,
  startRun,
} from "@/lib/api"
import { useRunStore } from "@/store/run-store"
import { ActivityRail } from "@/widgets/activity-rail"
import { ReplayDock } from "@/widgets/replay-dock"
import { SimulationStage } from "@/widgets/simulation-stage"
import { StartScreen } from "@/widgets/start-screen"
import { TopCommandBar } from "@/widgets/top-command-bar"
import { ReportDialog } from "@/features/report/report-dialog"
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
  "actor.message",
  "graph.delta",
  "log",
  "report.delta",
  "run.completed",
  "run.failed",
]

function App() {
  const { t } = useLocaleText()
  const queryClient = useQueryClient()
  const selectedRunId = useRunStore((state) => state.selectedRunId)
  const setSelectedRunId = useRunStore((state) => state.setSelectedRunId)
  const resetLiveState = useRunStore((state) => state.resetLiveState)
  const pushEvent = useRunStore((state) => state.pushEvent)
  const syncRunDetail = useRunStore((state) => state.syncRunDetail)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [homeVisible, setHomeVisible] = useState(true)
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false)
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const [scenarioPreviewOpen, setScenarioPreviewOpen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>({
    sourceName: "pasted-scenario.md",
    text: "",
    controls: { numCast: 6, allowAdditionalCast: true, actionsPerType: 3, fastMode: false },
  })

  const runsQuery = useQuery({ queryKey: ["runs"], queryFn: fetchRuns })
  const selectedRunQuery = useQuery({
    queryKey: ["runs", selectedRunId],
    queryFn: () => fetchRun(selectedRunId ?? ""),
    enabled: Boolean(selectedRunId),
  })
  const startMutation = useMutation({
    mutationFn: startRun,
    onSuccess: async () => {
      toast.success("Run started")
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Run failed"),
  })
  const startDraftMutation = useMutation({
    mutationFn: async (scenario: ScenarioInput) => {
      const run = await createRun(scenario)
      setSelectedRunId(run.id)
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
      await startRun(run.id)
      return run
    },
    onSuccess: async () => {
      toast.success("Simulation started")
      setScenarioPreviewOpen(false)
      setHomeVisible(false)
      await queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Run failed"),
  })

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
    syncRunDetail(selectedRunQuery.data.run, selectedRunQuery.data.timeline)
  }, [selectedRunQuery.data, syncRunDetail])

  useEffect(() => {
    if (!selectedRunId) {
      return
    }
    resetLiveState()
    const source = new EventSource(`/api/runs/${selectedRunId}/events`)
    const listeners = eventTypes.map((type) => {
      const listener = (message: MessageEvent<string>) => {
        pushEvent(JSON.parse(message.data) as RunEvent)
        if (type === "run.completed" || type === "run.failed") {
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
      source.close()
    }
  }, [pushEvent, queryClient, resetLiveState, selectedRunId])

  const selectedRun = runsQuery.data?.find((run) => run.id === selectedRunId)
  const isStarting = startMutation.isPending || startDraftMutation.isPending

  const startSelectedRun = () => {
    if (!selectedRunId) {
      return
    }
    startMutation.mutate(selectedRunId)
  }

  const downloadSelectedExport = (kind: "json" | "jsonl" | "md") => {
    if (!selectedRunId) {
      return
    }
    void downloadExport(selectedRunId, kind)
  }

  const startDraftRun = () => {
    if (!scenarioDraft.text.trim()) {
      return
    }
    startDraftMutation.mutate({
      sourceName: scenarioDraft.sourceName,
      text: scenarioDraft.text,
      controls: scenarioDraft.controls,
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

  if (homeVisible) {
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
          onNewScenario={() => setStoryBuilderOpen(true)}
          onUploadScenario={() => uploadInputRef.current?.click()}
          onExampleScenario={() => setSamplePickerOpen(true)}
          onRunHistory={() => setRunHistoryOpen(true)}
        />
        <StoryBuilderDialog
          open={storyBuilderOpen}
          t={t}
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
            setSelectedRunId(runId)
            setHomeVisible(false)
          }}
        />
        <ScenarioPreviewDialog
          open={scenarioPreviewOpen}
          draft={scenarioDraft}
          isStarting={isStarting}
          t={t}
          onOpenChange={setScenarioPreviewOpen}
          onDraftChange={setScenarioDraft}
          onStart={startDraftRun}
        />
      </>
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[1720px] flex-col px-4 py-3 lg:px-6">
        <TopCommandBar
          runs={runsQuery.data ?? []}
          selectedRunId={selectedRunId}
          selectedRunStatus={selectedRun?.status}
          isStarting={isStarting}
          t={t}
          onSelectRun={setSelectedRunId}
          onStartRun={startSelectedRun}
          onHome={() => setHomeVisible(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenReport={() => setReportOpen(true)}
          onExport={downloadSelectedExport}
        />

        <section className="grid min-h-0 flex-1 gap-4 py-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <SimulationStage />
          <ActivityRail />
        </section>

        <ReplayDock />
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ScenarioPreviewDialog
        open={scenarioPreviewOpen}
        draft={scenarioDraft}
        isStarting={isStarting}
        t={t}
        onOpenChange={setScenarioPreviewOpen}
        onDraftChange={setScenarioDraft}
        onStart={startDraftRun}
      />
      <ReportDialog
        open={reportOpen}
        selectedRunId={selectedRunId}
        onOpenChange={setReportOpen}
        onExport={downloadSelectedExport}
      />
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
