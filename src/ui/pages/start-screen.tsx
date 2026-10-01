/**
 * Purpose: Present source-first entry points and lightweight recent-run navigation.
 * Pattern: Dashboard composition.
 * Usage: Rendered by HomeView using already-loaded run manifests.
 * Related: src/ui/components/layout/workspace-frame.tsx, src/ui/styles/workspace.css
 */
import { ArchiveIcon, ArrowUpRightIcon, FileUpIcon, Gamepad2Icon, LanguagesIcon, SettingsIcon, SparklesIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { RunManifest } from "@/shared"
import { WorkspaceFrame } from "@/ui/components/layout/workspace-frame"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/ui/components/ui/dropdown-menu"
import { reportStatusLabel } from "@/ui/models/report/status-label"
import type { LanguagePreference, Locale, UiTexts } from "@/ui/types/i18n"

const RECENT_RUN_LIMIT = 6
interface StartScreenProps {
  t: UiTexts; languagePreference: LanguagePreference; promptLanguage: Locale
  runs: RunManifest[]; onOpenRun: (id: string) => void
  onNewScenario: () => void; onImportScenario: () => void; hasSavedPreview: boolean
  onResumeScenario: () => void; onExampleScenario: () => void; onRunHistory: () => void
  onOpenSettings: () => void; onLanguagePreferenceChange: (preference: LanguagePreference) => void
}
export function StartScreen({ t, languagePreference, promptLanguage, runs, onOpenRun, onNewScenario,
  onImportScenario, hasSavedPreview, onResumeScenario, onExampleScenario, onRunHistory, onOpenSettings, onLanguagePreferenceChange }: StartScreenProps) {
  const recent = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_RUN_LIMIT)
  const date = new Intl.DateTimeFormat(promptLanguage, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  return <WorkspaceFrame>
    <div className="dashboard-heading"><span className="dashboard-brand">Simula</span><div className="flex gap-2">
      <Button aria-label={t.settings} variant="ghost" size="icon" onClick={onOpenSettings}><SettingsIcon /></Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label={t.language} variant="ghost" size="icon"><LanguagesIcon /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuLabel>{t.promptLanguage}</DropdownMenuLabel><DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={languagePreference} onValueChange={value => {
            if (value === "en" || value === "ko" || value === "system") onLanguagePreferenceChange(value)
          }}><DropdownMenuGroup>
            <DropdownMenuRadioItem value="system">{t.languageSystem}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">{t.languageEnglish}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ko">{t.languageKorean}</DropdownMenuRadioItem>
          </DropdownMenuGroup></DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div></div>
    <header className="dashboard-intro"><h1>{t.workspaceTitle}</h1><p>{t.workspaceSubtitle}</p></header>
    <div className="workspace-split">
      <section className="dashboard-start" aria-label={t.workspaceStart}>
        <StartTile primary title={t.newScenario} body={t.newScenarioBody} icon={<SparklesIcon />} onClick={onNewScenario} />
        <p className="workspace-eyebrow">{t.workspaceAlternatives}</p>
        <StartTile title={t.builderImportScenario} body={t.importScenarioBody} icon={<FileUpIcon />} onClick={onImportScenario} />
        {hasSavedPreview ? <Button variant="secondary" onClick={onResumeScenario}>{t.resumeScenarioDraft}</Button> : null}
        <StartTile title={t.exampleScenario} body={t.exampleScenarioBody} icon={<Gamepad2Icon />} onClick={onExampleScenario} />
      </section>
      <section className="workspace-panel dashboard-recent" aria-label={t.workspaceRecent}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="workspace-panel-title">{t.workspaceRecent}</h2>
          <Button variant="ghost" size="sm" onClick={onRunHistory}><ArchiveIcon data-icon="inline-start" />{t.runHistory}</Button>
        </div>
        {recent.length ? <ul>{recent.map(run => <li key={run.id} className="dashboard-recent-row">
          <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold leading-6">{run.scenarioName ?? run.id}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{reportStatusLabel(run.status, t)}</Badge>
              <time className="text-xs text-muted-foreground" dateTime={run.createdAt}>{date.format(new Date(run.createdAt))}</time>
            </div>
          </div><Button variant="ghost" size="icon" aria-label={`${t.openRun}: ${run.scenarioName ?? run.id}`} onClick={() => onOpenRun(run.id)}><ArrowUpRightIcon /></Button>
        </li>)}</ul> : <p className="dashboard-empty">{t.workspaceRecentEmpty}</p>}
      </section>
    </div>
  </WorkspaceFrame>
}
function StartTile({ title, body, icon, onClick, primary = false }: {
  title: string; body: string; icon: ReactNode; onClick: () => void; primary?: boolean
}) {
  return <button type="button" className="dashboard-tile" data-primary={primary} onClick={onClick}>
    <span className="dashboard-tile-icon" aria-hidden="true">{icon}</span>
    <span className="min-w-0"><span className="block text-base font-semibold">{title}</span><span className="dashboard-tile-description">{body}</span></span>
  </button>
}
