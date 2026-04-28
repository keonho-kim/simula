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
        <ScrollArea className="h-[58svh] pr-3">
          <div className="grid gap-3">
            {(samplesQuery.data ?? []).map((sample) => (
              <div
                key={sample.name}
                className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{sample.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sample.name} · {sample.controls.numCast} cast · {sample.controls.maxRound} rounds · {sample.controls.actionsPerType} actions/type
                    </p>
                  </div>
                  <Button
                    variant="outline"
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
