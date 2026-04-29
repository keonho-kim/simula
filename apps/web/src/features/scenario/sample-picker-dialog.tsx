import { useMutation, useQuery } from "@tanstack/react-query"
import { Gamepad2Icon } from "lucide-react"
import type { ScenarioSampleDetail } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchScenarioSample, fetchScenarioSamples } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"

interface SamplePickerDialogProps {
  open: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
  onLoadSample: (sample: ScenarioSampleDetail) => void
}

export function SamplePickerDialog({
  open,
  t,
  onOpenChange,
  onLoadSample,
}: SamplePickerDialogProps) {
  const samplesQuery = useQuery({
    queryKey: ["scenario-samples"],
    queryFn: fetchScenarioSamples,
    enabled: open,
  })
  const loadMutation = useMutation({
    mutationFn: fetchScenarioSample,
    onSuccess: (sample) => {
      onLoadSample(sample)
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-hidden sm:max-w-[840px]">
        <DialogHeader>
          <DialogTitle>{t.samplePicker}</DialogTitle>
          <DialogDescription>{t.samplePickerDescription}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[58svh] pr-2 sm:pr-3">
          <div className="grid gap-3">
            {(samplesQuery.data ?? []).map((sample) => (
              <div
                key={sample.name}
                className="rounded-md bg-background/70 p-4 ring-1 ring-border/60"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold leading-5">{sample.title}</h3>
                    <p className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1 text-xs leading-5 text-muted-foreground">
                      <span className="min-w-0 break-all">{sample.name}</span>
                      <span>· {sample.controls.numCast} {t.sampleCastUnit}</span>
                      <span>· {sample.controls.maxRound} {t.sampleRoundsUnit}</span>
                      <span>· {sample.controls.actionsPerType} {t.sampleActionsPerTypeUnit}</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={loadMutation.isPending}
                    onClick={() => loadMutation.mutate(sample.name)}
                  >
                    <Gamepad2Icon data-icon="inline-start" />
                    {t.loadSample}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
