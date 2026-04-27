import type { ScenarioControls } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import type { UiTexts } from "@/lib/i18n"

export interface ScenarioDraft {
  sourceName: string
  text: string
  controls: ScenarioControls
}

interface ScenarioPreviewDialogProps {
  open: boolean
  draft: ScenarioDraft
  isStarting: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
  onDraftChange: (draft: ScenarioDraft) => void
  onStart: () => void
}

export function ScenarioPreviewDialog({
  open,
  draft,
  isStarting,
  t,
  onOpenChange,
  onDraftChange,
  onStart,
}: ScenarioPreviewDialogProps) {
  const canStart = draft.text.trim().length > 0 && draft.controls.numCast > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-hidden sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>{t.scenarioPreview}</DialogTitle>
          <DialogDescription>{t.scenarioPreviewDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">{t.scenarioText}</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {draft.sourceName}
              </p>
            </div>
            <ScrollArea className="h-[52svh] rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
              <pre className="whitespace-pre-wrap text-sm leading-6">
                {draft.text}
              </pre>
            </ScrollArea>
          </div>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="preview-num-cast">{t.castSize}</FieldLabel>
              <Input
                id="preview-num-cast"
                type="number"
                min={1}
                value={draft.controls.numCast}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    controls: {
                      ...draft.controls,
                      numCast: Number(event.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
              <Switch
                id="preview-allow-cast"
                checked={draft.controls.allowAdditionalCast}
                onCheckedChange={(allowAdditionalCast) =>
                  onDraftChange({
                    ...draft,
                    controls: { ...draft.controls, allowAdditionalCast },
                  })
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="preview-allow-cast">{t.allowExtraCast}</FieldLabel>
                <FieldDescription>{t.allowExtraCastHelp}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button disabled={!canStart || isStarting} onClick={onStart}>
            {t.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
