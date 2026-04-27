import {
  ArchiveIcon,
  FileUpIcon,
  Gamepad2Icon,
  SparklesIcon,
} from "lucide-react"
import type React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { UiTexts } from "@/lib/i18n"

interface StartScreenProps {
  t: UiTexts
  onNewScenario: () => void
  onUploadScenario: () => void
  onExampleScenario: () => void
  onRunHistory: () => void
}

export function StartScreen({
  t,
  onNewScenario,
  onUploadScenario,
  onExampleScenario,
  onRunHistory,
}: StartScreenProps) {
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[980px] flex-col justify-center gap-8 px-5 py-10">
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
            tone="sun"
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
    </main>
  )
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
  tone: "sky" | "mint" | "sun" | "rose"
  onClick: () => void
}) {
  const toneClass = {
    sky: "bg-[oklch(0.94_0.035_230)]",
    mint: "bg-[oklch(0.94_0.04_155)]",
    sun: "bg-[oklch(0.94_0.045_82)]",
    rose: "bg-[oklch(0.94_0.035_25)]",
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
