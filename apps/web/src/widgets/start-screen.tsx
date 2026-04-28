import {
  ArchiveIcon,
  FileUpIcon,
  Gamepad2Icon,
  LanguagesIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react"
import type React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { LanguagePreference, Locale, UiTexts } from "@/lib/i18n"

interface StartScreenProps {
  t: UiTexts
  languagePreference: LanguagePreference
  promptLanguage: Locale
  onNewScenario: () => void
  onUploadScenario: () => void
  onExampleScenario: () => void
  onRunHistory: () => void
  onOpenSettings: () => void
  onLanguagePreferenceChange: (preference: LanguagePreference) => void
}

export function StartScreen({
  t,
  languagePreference,
  promptLanguage,
  onNewScenario,
  onUploadScenario,
  onExampleScenario,
  onRunHistory,
  onOpenSettings,
  onLanguagePreferenceChange,
}: StartScreenProps) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[980px] flex-col gap-8 px-5 py-5">
        <div className="flex justify-end gap-1">
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

        <section className="grid gap-3">
          <StartTile
            title={t.newScenario}
            body={t.newScenarioBody}
            icon={<SparklesIcon />}
            tone="sky"
            onClick={onNewScenario}
          />
          <StartTile
            title={t.uploadScenario}
            body={t.uploadScenarioBody}
            icon={<FileUpIcon />}
            tone="mint"
            onClick={onUploadScenario}
          />
          <StartTile
            title={t.exampleScenario}
            body={t.exampleScenarioBody}
            icon={<Gamepad2Icon />}
            tone="violet"
            onClick={onExampleScenario}
          />
          <StartTile
            title={t.runHistory}
            body={t.runHistoryBody}
            icon={<ArchiveIcon />}
            tone="rose"
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
  onClick,
}: {
  title: string
  body: string
  icon: React.ReactNode
  tone: "sky" | "mint" | "violet" | "rose"
  onClick: () => void
}) {
  const toneClass = {
    sky: "bg-[#eef6ff]",
    mint: "bg-[#eefbf6]",
    violet: "bg-[#f5f3ff]",
    rose: "bg-[#fff1f4]",
  }[tone]

  return (
    <Button
      variant="outline"
      className="group h-auto justify-start rounded-2xl bg-card/95 p-4 text-left shadow-sm ring-1 ring-border/60 transition-transform hover:-translate-y-0.5 hover:bg-card hover:shadow-md sm:p-5"
      onClick={onClick}
    >
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-xl text-foreground ring-1 ring-border/60",
          toneClass
        )}
      >
        {icon}
      </span>
      <span className="ml-4 min-w-0">
        <span className="block text-base font-semibold">{title}</span>
        <span className="mt-1 block whitespace-normal text-sm font-normal leading-5 text-muted-foreground">
          {body}
        </span>
      </span>
    </Button>
  )
}
