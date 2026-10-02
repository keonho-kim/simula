/**
 * Purpose: Coordinate unified scenario creation, completed imports, settings, samples, and history.
 * Pattern: Page-flow component.
 * Usage: Rendered by App across source, settings, and simulation management workspace views.
 * Related: src/ui/pages/start-screen.tsx, src/ui/shell/App.tsx
 */
import { isWorkspaceView, type ViewMode } from "./browser-route"
import { readRunSession, updateRunSession } from "@/ui/browser-storage/run-session"
import { prepareScenarioDraft } from "@/ui/browser-storage/prepare-scenario-draft"
import { validMultiverse } from "@/ui/models/scenario-builder/launch-options"
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
const ScenarioPreviewPage = lazy(() =>
  import("@/ui/pages/scenario-preview-page").then((module) => ({ default: module.ScenarioPreviewPage }))
)
const SettingsPage = lazy(() =>
  import("@/ui/pages/settings-page").then((module) => ({ default: module.SettingsPage }))
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
  viewMode: ViewMode
  onNavigate: (view: ViewMode) => void
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
  viewMode, onNavigate,
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
  const [builderUsed, setBuilderUsed] = useState(viewMode === "scenario-new" || documentAnalysis || viewMode === "simulations")
  const scenarioBuilder = viewMode === "scenario-new"
  const [settingsReturn, setSettingsReturn] = useState<ViewMode>(() => {
    const saved = readRunSession().settingsReturnView
    return saved && saved !== "settings" && isWorkspaceView(saved) ? saved : "home"
  })
  const openSettings = () => {
    setSettingsReturn(viewMode)
    updateRunSession({ settingsReturnView: viewMode })
    onNavigate("settings")
  }
  const [previewRevision, setPreviewRevision] = useState(0)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const settingsOpen = viewMode === "settings"
  const scenarioPreviewOpen = viewMode === "scenario-preview"
  const setScenarioPreviewOpen = (open: boolean) => { if (open) { setPreviewLoaded(true); setPreviewRevision(value => value + 1) }; onNavigate(open ? "scenario-preview" : "home") }
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>(DEFAULT_SCENARIO_DRAFT)
  const [launchSeed, setLaunchSeed] = useState<string>()
  const [preparingBatch, setPreparingBatch] = useState(false)
  const [startError, setStartError] = useState(false)
  const [hasSavedPreview, setHasSavedPreview] = useState(false)
  const samplePickerPresent = useExitPresence(samplePickerOpen)
  const runHistoryPresent = useExitPresence(runHistoryOpen)



  useEffect(() => { if (scenarioBuilder) setBuilderUsed(true) }, [scenarioBuilder])
  useEffect(() => { if (viewMode !== "scenario-preview" || previewLoaded) return
    void readDraft<{ draft: ScenarioDraft; autoContinue: boolean }>("finished-scenario").then(value => {
      const restored = value?.working ?? value?.saved
      if (restored) { setScenarioDraft(restored.draft); onAutoContinueChange(restored.autoContinue) }
      setPreviewLoaded(true)
    })
  }, [viewMode, previewLoaded, onAutoContinueChange])
  useEffect(() => { void readDraft<{ draft: ScenarioDraft; autoContinue: boolean }>("finished-scenario")
    .then(value => setHasSavedPreview(Boolean(value?.saved))) }, [])

  const loadScenarioFile = (file: File) => {
    void file.text().then((text) => {
      setScenarioDraft(current => ({ ...current, sourceName: file.name, text }))
      setScenarioPreviewOpen(true)
    })
  }

  const startScenario = async () => {
    if (!scenarioDraft.text.trim() || !validMultiverse(scenarioDraft.multiverse) || preparingBatch) return
    if (scenarioDraft.multiverse?.enabled) {
      setPreparingBatch(true); setStartError(false)
      try {
        await prepareScenarioDraft(scenarioDraft)
        setLaunchSeed(crypto.randomUUID())
        setScenarioPreviewOpen(false)

        onDocumentAnalysisChange(true)
      } catch { setStartError(true) }
      finally { setPreparingBatch(false) }
      return
    }
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
      {viewMode === "home" ? <StartScreen
        runs={runs} onOpenRun={onOpenRun}
        t={t}
        languagePreference={languagePreference}
        promptLanguage={promptLanguage}
        onNewScenario={() => onNavigate("scenario-new")}
        onImportScenario={() => uploadInputRef.current?.click()}
        hasSavedPreview={hasSavedPreview}
        onResumeScenario={() => { void readDraft<{ draft: ScenarioDraft; autoContinue: boolean }>("finished-scenario")
          .then(value => { if (!value?.saved) return; setScenarioDraft(value.saved.draft); onAutoContinueChange(value.saved.autoContinue); setScenarioPreviewOpen(true) }) }}
        onExampleScenario={() => setSamplePickerOpen(true)}
        onRunHistory={() => setRunHistoryOpen(true)}
        onOpenSettings={openSettings}
        onLanguagePreferenceChange={onLanguagePreferenceChange}
      /> : null}
      <Suspense fallback={null}>
        {builderUsed || scenarioBuilder || documentAnalysis || viewMode === "simulations" ? (
          <ScenarioCreationFlow key={launchSeed ?? "new-scenario"}
            autoExecute={Boolean(launchSeed)}
            active={scenarioBuilder}
            analysis={documentAnalysis}
            simulations={viewMode === "simulations"}
            onSimulations={() => onNavigate("simulations")}
            onDocuments={() => onNavigate("document-analysis")}
            onAnalyze={() => onDocumentAnalysisChange(true)}
            onHome={() => onDocumentAnalysisChange(false)}
            onEdit={() => onNavigate("scenario-new")}
            language={promptLanguage}
            t={t}
            onClose={() => onNavigate("home")}
            onOpenSettings={openSettings}
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
        {previewLoaded ? (
          <ScenarioPreviewPage key={previewRevision}
            open={scenarioPreviewOpen}
            draft={scenarioDraft}
            startError={startError}
            isStarting={isStarting || preparingBatch}
            autoContinue={autoContinue}
            t={t}
            onOpenChange={setScenarioPreviewOpen}
            onDraftChange={setScenarioDraft}
            onAutoContinueChange={onAutoContinueChange}
            onOpenSettings={openSettings}
            onStart={startScenario}
            onDraftSaved={() => setHasSavedPreview(true)}
          />
        ) : null}
        {settingsOpen ? <SettingsPage open t={t} onOpenChange={() => onNavigate(settingsReturn)} /> : null}
      </Suspense>
    </>
  )
}
