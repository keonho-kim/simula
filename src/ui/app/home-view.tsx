/**
 * Purpose: Own landing-page scenario drafting, upload, settings, samples, and history UI state.
 * Pattern: Page-flow component.
 * Usage: Rendered by App while the active view is home.
 * Related: src/ui/pages/start-screen.tsx, src/ui/app/App.tsx
 */
import { Suspense, lazy, useRef, useState } from "react"
import type { PromptLanguage, RunManifest, ScenarioInput } from "@/shared"
import { StartScreen } from "@/ui/pages/start-screen"
import type { LanguagePreference, UiTexts } from "@/ui/types/i18n"
import type { ScenarioDraft } from "@/ui/types/scenario"

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
const StoryBuilderDialog = lazy(() =>
  import("@/ui/components/scenario/story-builder-dialog").then((module) => ({ default: module.StoryBuilderDialog }))
)

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
  onOpenRun: (runId: string) => void
  onStartScenario: (scenario: ScenarioInput) => void
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
}: HomeViewProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [storyBuilderOpen, setStoryBuilderOpen] = useState(false)
  const [samplePickerOpen, setSamplePickerOpen] = useState(false)
  const [runHistoryOpen, setRunHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scenarioPreviewOpen, setScenarioPreviewOpen] = useState(false)
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft>(DEFAULT_SCENARIO_DRAFT)

  const loadScenarioFile = (file: File) => {
    void file.text().then((text) => {
      setScenarioDraft({ ...scenarioDraft, sourceName: file.name, text })
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
        accept=".md,.txt"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) loadScenarioFile(file)
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
        onLanguagePreferenceChange={onLanguagePreferenceChange}
      />
      <Suspense fallback={null}>
        {storyBuilderOpen ? (
          <StoryBuilderDialog
            open
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
            open
            t={t}
            onOpenChange={setSamplePickerOpen}
            onLoadSample={(sample) => {
              setScenarioDraft({ sourceName: sample.name, text: sample.text, controls: sample.controls })
              setScenarioPreviewOpen(true)
            }}
          />
        ) : null}
        {runHistoryOpen ? (
          <RunHistoryDialog open runs={runs} t={t} onOpenChange={setRunHistoryOpen} onOpenRun={onOpenRun} />
        ) : null}
        {scenarioPreviewOpen ? (
          <ScenarioPreviewDialog
            open
            draft={scenarioDraft}
            isStarting={isStarting}
            autoContinue={autoContinue}
            t={t}
            onOpenChange={setScenarioPreviewOpen}
            onDraftChange={setScenarioDraft}
            onAutoContinueChange={onAutoContinueChange}
            onOpenSettings={() => {
              setScenarioPreviewOpen(false)
              setSettingsOpen(true)
            }}
            onStart={startScenario}
          />
        ) : null}
        {settingsOpen ? <SettingsDialog open t={t} onOpenChange={setSettingsOpen} /> : null}
      </Suspense>
    </>
  )
}
