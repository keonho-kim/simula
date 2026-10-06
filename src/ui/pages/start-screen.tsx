/**
 * Purpose: Present source-first entry points and lightweight recent-run navigation.
 * Pattern: Dashboard composition.
 * Usage: Rendered by HomeView using already-loaded run manifests.
 * Related: src/ui/components/layout/workspace-frame.tsx, src/ui/styles/dashboard.css
 */
import { ArchiveIcon, ArrowUpRightIcon, FileUpIcon, Gamepad2Icon, LanguagesIcon, SettingsIcon, SparklesIcon } from "lucide-react"
import type { RunManifest } from "@/shared"
import "@/ui/styles/dashboard.css"
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
    <div className="dashboard-heading"><span className="dashboard-brand"><span className="dashboard-brand-mark" aria-hidden="true" />Simula</span><div className="flex gap-2">
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
    <div className="dashboard-workspace">
      <nav className="dashboard-navigation" aria-label={t.workspaceStart}>
        <Button onClick={onNewScenario}><SparklesIcon data-icon="inline-start" />{t.newScenario}</Button>
        {hasSavedPreview ? <Button variant="secondary" onClick={onResumeScenario}>{t.resumeScenarioDraft}</Button> : null}
        <div className="dashboard-navigation-group">
          <Button variant="ghost" onClick={onImportScenario}><FileUpIcon data-icon="inline-start" />{t.builderImportScenario}</Button>
          <Button variant="ghost" onClick={onExampleScenario}><Gamepad2Icon data-icon="inline-start" />{t.exampleScenario}</Button>
        </div>
        <div className="dashboard-navigation-group">
          <Button variant="ghost" onClick={onRunHistory}><ArchiveIcon data-icon="inline-start" />{t.runHistory}</Button>
          <Button variant="ghost" onClick={onOpenSettings}><SettingsIcon data-icon="inline-start" />{t.settings}</Button>
        </div>
      </nav>
      <div className="dashboard-content">
        <header className="dashboard-intro"><h1>{t.workspaceTitle}</h1><p>{t.workspaceSubtitle}</p></header>
        <dl className="dashboard-summary">
          <div><dt>{t.simulationsTotal}</dt><dd>{new Intl.NumberFormat(promptLanguage).format(runs.length)}</dd></div>
          <div><dt>{t.simulationsActive}</dt><dd>{new Intl.NumberFormat(promptLanguage).format(runs.filter(run => run.status === "running" || run.status === "created").length)}</dd></div>
          <div><dt>{t.simulationsAttention}</dt><dd>{new Intl.NumberFormat(promptLanguage).format(runs.filter(run => run.status === "failed" || run.status === "interrupted").length)}</dd></div>
        </dl>
      <section className="workspace-panel dashboard-recent" aria-label={t.workspaceRecent}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="workspace-panel-title">{t.workspaceRecent}</h2>
          <Badge variant="secondary">{new Intl.NumberFormat(promptLanguage).format(recent.length)}</Badge>
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
    </div>
  </WorkspaceFrame>
}
