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
        <ScrollArea className="h-[52svh] pr-2 sm:pr-3">
          <div className="grid gap-3">
            {runs.length ? (
              runs.map((run) => (
                <div
                  key={run.id}
                  className="rounded-md bg-background/70 p-4 ring-1 ring-border/60"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold leading-5">{run.scenarioName ?? run.id}</h3>
                      <p className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1 text-xs leading-5 text-muted-foreground">
                        <span>{run.status}</span>
                        <span>· {run.createdAt}</span>
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
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
              <div className="rounded-md border border-dashed border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
                {t.noRuns}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
