import { useMutation, useQuery } from "@tanstack/react-query"
import { Gamepad2Icon } from "lucide-react"
import type { ScenarioLoadLevel, ScenarioSampleDetail, ScenarioSampleSummary } from "@simula/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchScenarioSample, fetchScenarioSamples } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"

const loadLevels: ScenarioLoadLevel[] = ["low", "middle", "high"]

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
  const samples = samplesQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-hidden sm:max-w-[840px]">
        <DialogHeader>
          <DialogTitle>{t.samplePicker}</DialogTitle>
          <DialogDescription>{t.samplePickerDescription}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="middle" className="min-h-0 gap-3">
          <TabsList className="grid w-full grid-cols-3">
            {loadLevels.map((level) => (
              <TabsTrigger key={level} value={level}>
                {loadLevelLabel(level, t)}
              </TabsTrigger>
            ))}
          </TabsList>
          {loadLevels.map((level) => (
            <TabsContent key={level} value={level} className="min-h-0 overflow-hidden">
              <ScrollArea className="h-[54svh] pr-2 sm:pr-3">
                <div className="grid gap-3">
                  {samples
                    .filter((sample) => sampleLoadLevel(sample) === level)
                    .map((sample) => (
                      <div
                        key={sample.name}
                        className="rounded-md bg-background/70 p-4 ring-1 ring-border/60"
                      >
                        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="break-words text-sm font-semibold leading-5">{sample.title}</h3>
                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-5 text-muted-foreground">
                              <span className="min-w-0 break-all">{sample.name}</span>
                              <span>· {sample.controls.numCast} {t.sampleCastUnit}</span>
                              <span>· {sample.controls.maxRound} {t.sampleRoundsUnit}</span>
                              <span>· {sample.controls.actionsPerType} {t.sampleActionsPerTypeUnit}</span>
                              <span>·</span>
                              <Badge variant="secondary" className="rounded-sm">
                                {t.sampleLoadUnit}: {loadLevelLabel(sampleLoadLevel(sample), t)}
                              </Badge>
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
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function sampleLoadLevel(sample: ScenarioSampleSummary): ScenarioLoadLevel {
  return sample.controls.loadLevel ?? "middle"
}

function loadLevelLabel(level: ScenarioLoadLevel, t: UiTexts): string {
  if (level === "low") {
    return t.sampleLoadLow
  }
  if (level === "high") {
    return t.sampleLoadHigh
  }
  return t.sampleLoadMiddle
}
