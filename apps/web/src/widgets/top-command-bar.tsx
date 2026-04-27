import {
  DownloadIcon,
  FileTextIcon,
  HomeIcon,
  MenuIcon,
  PlayIcon,
  SettingsIcon,
} from "lucide-react"
import type { RunManifest } from "@simula/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RunSelector } from "@/entities/run/run-selector"
import type { UiTexts } from "@/lib/i18n"

interface TopCommandBarProps {
  runs: RunManifest[]
  selectedRunId?: string
  selectedRunStatus?: string
  isStarting: boolean
  t: UiTexts
  onSelectRun: (runId: string | undefined) => void
  onStartRun: () => void
  onHome: () => void
  onOpenSettings: () => void
  onOpenReport: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}

export function TopCommandBar({
  runs,
  selectedRunId,
  selectedRunStatus,
  isStarting,
  t,
  onSelectRun,
  onStartRun,
  onHome,
  onOpenSettings,
  onOpenReport,
  onExport,
}: TopCommandBarProps) {
  const hasRun = Boolean(selectedRunId)

  return (
    <header className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/92 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Open menu" variant="ghost" size="icon" className="rounded-md">
                <MenuIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={onHome}>
                  <HomeIcon />
                  {t.home}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onOpenSettings}>
                  <SettingsIcon />
                  {t.settings}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!hasRun} onSelect={onOpenReport}>
                  <FileTextIcon />
                  {t.report}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Export</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={!hasRun} onSelect={() => onExport("json")}>
                  <DownloadIcon />
                  {t.exportJson}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!hasRun} onSelect={() => onExport("jsonl")}>
                  <DownloadIcon />
                  {t.exportJsonl}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!hasRun} onSelect={() => onExport("md")}>
                  <DownloadIcon />
                  {t.exportMarkdown}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-heading text-lg font-semibold tracking-normal">Simula</h1>
              {selectedRunStatus ? (
                <Badge variant="secondary" className="rounded-md px-2 py-0.5 text-[11px] uppercase tracking-normal">
                  {selectedRunStatus}
                </Badge>
              ) : null}
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="hidden sm:block">
            <RunSelector runs={runs} selectedRunId={selectedRunId} onSelect={onSelectRun} />
          </div>
          <Button disabled={!hasRun || isStarting} onClick={onStartRun} className="h-9 rounded-md">
            <PlayIcon data-icon="inline-start" />
            {t.execute}
          </Button>
        </div>
      </div>
      <div className="mt-3 sm:hidden">
        <RunSelector runs={runs} selectedRunId={selectedRunId} onSelect={onSelectRun} />
      </div>
    </header>
  )
}
