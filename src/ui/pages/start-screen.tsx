/**
 * Purpose: Present landing actions and locale controls for starting or resuming work.
 * Pattern: Page component.
 * Usage: Rendered by src/ui/shell/App.tsx in home mode.
 * Related: src/ui/animation/interaction.ts, src/ui/i18n/messages/common.ts
 */
import {
  ArchiveIcon,
  FileUpIcon,
  Gamepad2Icon,
  LanguagesIcon,
  SettingsIcon,
  SparklesIcon,
  DownloadIcon,
  UploadIcon,
} from "lucide-react"
import type React from "react"
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu"
import { cn } from "@/ui/lib/class-names"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { START_TILE_ICON_VARIANTS, startTileMotion } from "@/ui/animation/interaction"
import type { LanguagePreference, Locale, UiTexts } from "@/ui/types/i18n"

interface StartScreenProps {
  t: UiTexts
  languagePreference: LanguagePreference
  promptLanguage: Locale
  onNewScenario: () => void
  onImportScenario: () => void
  hasSavedPreview: boolean
  onResumeScenario: () => void
  onExampleScenario: () => void
  onRunHistory: () => void
  onOpenSettings: () => void
  onExportBackup: () => void
  onImportBackup: () => void
  onLanguagePreferenceChange: (preference: LanguagePreference) => void
}

export function StartScreen({
  t,
  languagePreference,
  promptLanguage,
  onNewScenario,
  onImportScenario,
  hasSavedPreview,
  onResumeScenario,
  onExampleScenario,
  onRunHistory,
  onOpenSettings,
  onExportBackup,
  onImportBackup,
  onLanguagePreferenceChange,
}: StartScreenProps) {
  const reducedMotion = useReducedMotionPreference()
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[980px] flex-col gap-8 px-5 py-5">
        <div className="flex justify-end gap-1">
          <Button aria-label={t.backupExport} title={t.backupExport} variant="ghost" size="icon" onClick={onExportBackup}><DownloadIcon /></Button>
          <Button aria-label={t.backupImport} title={t.backupImport} variant="ghost" size="icon" onClick={onImportBackup}><UploadIcon /></Button>
          <Button aria-label={t.settings} variant="ghost" size="icon" className="rounded-md" onClick={onOpenSettings}>
            <SettingsIcon />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t.language} variant="ghost" size="icon" className="rounded-md">
                <LanguagesIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>{t.promptLanguage}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={languagePreference}
                onValueChange={(value) => onLanguagePreferenceChange(value as LanguagePreference)}
              >
                <DropdownMenuGroup>
                  <DropdownMenuRadioItem value="system">
                    {t.languageSystem} · {languageLabel(promptLanguage, t)}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="en">{t.languageEnglish}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ko">{t.languageKorean}</DropdownMenuRadioItem>
                </DropdownMenuGroup>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 pb-10">
        <header className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Simula</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-normal sm:text-5xl">
            {t.homeTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-sm leading-6 text-muted-foreground">
            {t.homeSubtitle}
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <StartTile
            title={t.newScenario}
            body={t.newScenarioBody}
            icon={<SparklesIcon />}
            tone="sky"
            reducedMotion={reducedMotion}
            onClick={onNewScenario}
          />
          <StartTile
            title={t.builderImportScenario}
            body={t.importScenarioBody}
            icon={<FileUpIcon />}
            tone="mint"
            reducedMotion={reducedMotion}
            onClick={onImportScenario}
          />
          {hasSavedPreview ? <Button variant="ghost" size="sm" className="-mt-2 ml-auto" onClick={onResumeScenario}>{t.resumeScenarioDraft}</Button> : null}
          <StartTile
            title={t.exampleScenario}
            body={t.exampleScenarioBody}
            icon={<Gamepad2Icon />}
            tone="violet"
            reducedMotion={reducedMotion}
            onClick={onExampleScenario}
          />
          <StartTile
            title={t.runHistory}
            body={t.runHistoryBody}
            icon={<ArchiveIcon />}
            tone="rose"
            reducedMotion={reducedMotion}
            onClick={onRunHistory}
          />
        </section>
        </div>
      </div>
    </main>
  )
}

function languageLabel(locale: Locale, t: UiTexts): string {
  return locale === "ko" ? t.languageKorean : t.languageEnglish
}

function StartTile({
  title,
  body,
  icon,
  tone,
  reducedMotion,
  onClick,
}: {
  title: string
  body: string
  icon: React.ReactNode
  tone: "sky" | "mint" | "violet" | "rose"
  reducedMotion: boolean
  onClick: () => void
}) {
  const toneClass = {
    sky: "bg-[#eef6ff]",
    mint: "bg-[#eefbf6]",
    violet: "bg-[#f5f3ff]",
    rose: "bg-[#fff1f4]",
  }[tone]

  return (
    <Button asChild variant="outline" className="start-menu-tile group h-auto justify-start rounded-xl bg-card/95 p-4 text-left ring-1 ring-border/60 hover:bg-card sm:p-5" onClick={onClick}>
      <m.button type="button" {...startTileMotion(reducedMotion)}>
      <m.span
        variants={reducedMotion ? undefined : START_TILE_ICON_VARIANTS}
        className={cn(
          "start-menu-icon flex size-14 shrink-0 items-center justify-center rounded-lg text-foreground ring-1 ring-border/60",
          toneClass
        )}
      >
        {icon}
      </m.span>
      <span className="ml-4 min-w-0">
        <span className="block text-base font-semibold">{title}</span>
        <span className="mt-1 block whitespace-normal text-sm font-normal leading-5 text-muted-foreground">
          {body}
        </span>
      </span>
      </m.button>
    </Button>
  )
}
