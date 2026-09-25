/**
 * Purpose: Coordinate unified scenario creation, completed imports, settings, samples, and history.
 * Pattern: Page-flow component.
 * Usage: Rendered by App while the active view is home.
 * Related: src/ui/pages/start-screen.tsx, src/ui/shell/App.tsx
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import type { PromptLanguage, RunManifest, ScenarioInput } from "@/shared"
import { StartScreen } from "@/ui/pages/start-screen"
import type { LanguagePreference, UiTexts } from "@/ui/types/i18n"
import type { ScenarioDraft } from "@/ui/types/scenario"
import { readDraft } from "@/ui/browser-storage/database/drafts/read"
import { exportBrowserBackup, importBrowserBackup } from "@/ui/browser-storage/backup"
import { toast } from "sonner"
import { useExitPresence } from "@/ui/animation/use-exit-presence"

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
const ScenarioBuilderDialog = lazy(() => import("@/ui/components/scenario-builder/scenario-builder-dialog").then(module => ({ default: module.ScenarioBuilderDialog })))

const DEFAULT_SCENARIO_DRAFT: ScenarioDraft = {
  sourceName: "pasted-scenario.md",
  text: "",
  controls: {
    numCast: 6,
    allowAdditionalCast: true,
    actionsPerType: 3,
    maxRound: 8,
    fastMode: false,
    autonomousProgress: false,
    outputLength: "short",
  },
}

interface HomeViewProps {
  t: UiTexts
  languagePreference: LanguagePreference
  promptLanguage: PromptLanguage
  runs: RunManifest[]
  isStarting: boolean
  autoContinue: boolean
  onAutoContinueChange: (enabled: boolean) => void
  onLanguagePreferenceChange: (preference: LanguagePreference) => void
  onOpenRun: (runId: string, view?: "simulation" | "report") => void
  onStartScenario: (scenario: ScenarioInput) => void
  onStartWorld: (worldId: string) => void
}

export function HomeView({
  t,
  languagePreference,
  promptLanguage,
  runs,
  isStarting,
  autoContinue,
  onAutoContinueChange,
  onLanguagePreferenceChange,
  onOpenRun,
  onStartScenario,
  onStartWorld,
}: HomeViewProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)
  const [scenarioBuilder, setScenarioBuilder] = useState<"unused" | "open" | "closed">("unused")
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scenarioPreviewOpen, setScenarioPreviewOpen] = useState(false)
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>(DEFAULT_SCENARIO_DRAFT)
  const [hasSavedPreview, setHasSavedPreview] = useState(false)
  const samplePickerPresent = useExitPresence(samplePickerOpen)
  const runHistoryPresent = useExitPresence(runHistoryOpen)
  const previewPresent = useExitPresence(scenarioPreviewOpen)
  const settingsPresent = useExitPresence(settingsOpen)

  useEffect(() => { void readDraft<{ draft: ScenarioDraft; autoContinue: boolean }>("finished-scenario")
    .then(value => setHasSavedPreview(Boolean(value?.saved))) }, [])

  const loadScenarioFile = (file: File) => {
    void file.text().then((text) => {
      setScenarioDraft(current => ({ ...current, sourceName: file.name, text }))
      setScenarioPreviewOpen(true)
    })
  }

  const startScenario = () => {
    if (!scenarioDraft.text.trim()) return
    onStartScenario({
      sourceName: scenarioDraft.sourceName,
      text: scenarioDraft.text,
      controls: scenarioDraft.controls,
      language: promptLanguage,
    })
  }

  const exportBackup = async () => {
    try {
      const blob = await exportBrowserBackup()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `simula-backup-${new Date().toISOString().slice(0, 10)}.zip`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) { toast.error(error instanceof Error ? error.message : t.backupFailed) }
  }

  const importBackup = async (file: File) => {
    if (!window.confirm(t.backupImportConfirm)) return
    try { await importBrowserBackup(file); window.location.reload() }
    catch (error) { toast.error(error instanceof Error ? error.message : t.backupFailed) }
  }

  return (
    <>
      <input
        ref={backupInputRef}
        className="sr-only"
        type="file"
        aria-label={t.backupImport}
        accept=".zip,application/zip"
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importBackup(file) }}
      />
      <input
        ref={uploadInputRef}
        className="sr-only"
        type="file"
        aria-hidden="true"
        tabIndex={-1}
        accept=".md,.txt"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) loadScenarioFile(file)
        }}
      />
      {scenarioBuilder !== "open" ? <StartScreen
        t={t}
        languagePreference={languagePreference}
        promptLanguage={promptLanguage}
        onNewScenario={() => setScenarioBuilder("open")}
        onImportScenario={() => uploadInputRef.current?.click()}
        hasSavedPreview={hasSavedPreview}
        onResumeScenario={() => { void readDraft<{ draft: ScenarioDraft; autoContinue: boolean }>("finished-scenario")
          .then(value => { if (!value?.saved) return; setScenarioDraft(value.saved.draft); onAutoContinueChange(value.saved.autoContinue); setScenarioPreviewOpen(true) }) }}
        onExampleScenario={() => setSamplePickerOpen(true)}
        onRunHistory={() => setRunHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onLanguagePreferenceChange={onLanguagePreferenceChange}
        onExportBackup={() => { void exportBackup() }}
        onImportBackup={() => backupInputRef.current?.click()}
      /> : null}
      <Suspense fallback={null}>
        {scenarioBuilder !== "unused" ? (
          <ScenarioBuilderDialog
            active={scenarioBuilder === "open"}
            language={promptLanguage}
            t={t}
            onBack={() => setScenarioBuilder("closed")}
            onOpenSettings={() => setSettingsOpen(true)}
            starting={isStarting}
            autoContinue={autoContinue}
            onAutoContinueChange={onAutoContinueChange}
            onStartWorld={onStartWorld}
            onOpenRun={onOpenRun}
          />
        ) : null}
        {samplePickerPresent ? (
          <SamplePickerDialog
            open={samplePickerOpen}
            t={t}
            onOpenChange={setSamplePickerOpen}
            onLoadSample={(sample) => {
              setScenarioDraft({ sourceName: sample.name, text: sample.text, controls: sample.controls })
              setScenarioPreviewOpen(true)
            }}
          />
        ) : null}
        {runHistoryPresent ? (
          <RunHistoryDialog open={runHistoryOpen} runs={runs} t={t} onOpenChange={setRunHistoryOpen} onOpenRun={onOpenRun} />
        ) : null}
        {previewPresent ? (
          <ScenarioPreviewDialog
            open={scenarioPreviewOpen}
            draft={scenarioDraft}
            isStarting={isStarting}
            autoContinue={autoContinue}
            t={t}
            onOpenChange={setScenarioPreviewOpen}
            onDraftChange={setScenarioDraft}
            onAutoContinueChange={onAutoContinueChange}
            onOpenSettings={() => setSettingsOpen(true)}
            onStart={startScenario}
            onDraftSaved={() => setHasSavedPreview(true)}
          />
        ) : null}
        {settingsPresent ? <SettingsDialog open={settingsOpen} t={t} onOpenChange={setSettingsOpen} /> : null}
      </Suspense>
    </>
  )
}
