import { ArchiveIcon } from "lucide-react"
import type { RunManifest } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UiTexts } from "@/lib/i18n"

interface RunHistoryDialogProps {
  open: boolean
  runs: RunManifest[]
  t: UiTexts
  onOpenChange: (open: boolean) => void
  onOpenRun: (runId: string) => void
}

export function RunHistoryDialog({
  open,
  runs,
  t,
  onOpenChange,
  onOpenRun,
}: RunHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-hidden sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t.historyPicker}</DialogTitle>
          <DialogDescription>{t.historyPickerDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[52svh] pr-3">
          <div className="grid gap-3">
            {runs.length ? (
              runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{run.scenarioName ?? run.id}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {run.status} · {run.createdAt}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        onOpenRun(run.id)
                        onOpenChange(false)
                      }}
                    >
                      <ArchiveIcon data-icon="inline-start" />
                      {t.openRun}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
                {t.noRuns}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
