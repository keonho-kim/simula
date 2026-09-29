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
const ScenarioCreationFlow = lazy(() => import("@/ui/shell/scenario-creation-flow").then(module => ({ default: module.ScenarioCreationFlow })))

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
  documentAnalysis: boolean
  onDocumentAnalysisChange: (active: boolean) => void
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
  documentAnalysis,
  onDocumentAnalysisChange,
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

  return (
    <>
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
      {!documentAnalysis ? <StartScreen
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
      /> : null}
      <Suspense fallback={null}>
        {scenarioBuilder !== "unused" || documentAnalysis ? (
          <ScenarioCreationFlow
            active={scenarioBuilder === "open"}
            analysis={documentAnalysis}
            onAnalyze={() => { setScenarioBuilder("closed"); onDocumentAnalysisChange(true) }}
            onHome={() => { setScenarioBuilder("closed"); onDocumentAnalysisChange(false) }}
            onEdit={() => { setScenarioBuilder("open"); onDocumentAnalysisChange(false) }}
            language={promptLanguage}
            t={t}
            onClose={() => setScenarioBuilder("closed")}
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
