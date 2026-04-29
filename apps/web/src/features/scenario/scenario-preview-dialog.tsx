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
import { MarkdownContent } from "@/shared/ui/markdown-content"

export interface ScenarioDraft {
  sourceName: string
  text: string
  controls: ScenarioControls
}

interface ScenarioPreviewDialogProps {
  open: boolean
  draft: ScenarioDraft
  isStarting: boolean
  autoContinue: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
  onDraftChange: (draft: ScenarioDraft) => void
  onAutoContinueChange: (autoContinue: boolean) => void
  onOpenSettings: () => void
  onStart: () => void
}

export function ScenarioPreviewDialog({
  open,
  draft,
  isStarting,
  autoContinue,
  t,
  onOpenChange,
  onDraftChange,
  onAutoContinueChange,
  onOpenSettings,
  onStart,
}: ScenarioPreviewDialogProps) {
  const canStart = draft.text.trim().length > 0 && draft.controls.numCast > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-hidden sm:max-w-[880px]">
        <DialogHeader>
          <DialogTitle>{t.scenarioPreview}</DialogTitle>
          <DialogDescription>{t.scenarioPreviewDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">{t.scenarioText}</h3>
              <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                {draft.sourceName}
              </p>
            </div>
            <ScrollArea className="h-[34svh] rounded-md bg-background/70 p-4 ring-1 ring-border/60 lg:h-[52svh]">
              <MarkdownContent content={draft.text} />
            </ScrollArea>
          </div>

          <ScrollArea className="max-h-[32svh] pr-2 lg:max-h-none lg:pr-0">
          <FieldGroup className="pr-1 lg:pr-0">
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
            <Field>
              <FieldLabel htmlFor="preview-max-round">{t.maxRound}</FieldLabel>
              <Input
                id="preview-max-round"
                type="number"
                min={1}
                value={draft.controls.maxRound}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    controls: {
                      ...draft.controls,
                      maxRound: Number(event.target.value),
                    },
                  })
                }
              />
              <FieldDescription>{t.maxRoundHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="preview-context-token-budget">{t.actorContextTokens}</FieldLabel>
              <Input
                id="preview-context-token-budget"
                type="number"
                min={1}
                value={draft.controls.actorContextTokenBudget ?? 2000}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    controls: {
                      ...draft.controls,
                      actorContextTokenBudget: Number(event.target.value),
                    },
                  })
                }
              />
              <FieldDescription>{t.actorContextTokensHelp}</FieldDescription>
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
            <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
              <Switch
                id="preview-fast-mode"
                checked={draft.controls.fastMode}
                onCheckedChange={(fastMode) =>
                  onDraftChange({
                    ...draft,
                    controls: { ...draft.controls, fastMode },
                  })
                }
              />
              <FieldContent>
                <FieldLabel htmlFor="preview-fast-mode">{t.fastMode}</FieldLabel>
                <FieldDescription>{t.fastModeHelp}</FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
              <Switch
                id="preview-auto-continue"
                checked={autoContinue}
                onCheckedChange={onAutoContinueChange}
              />
              <FieldContent>
                <FieldLabel htmlFor="preview-auto-continue">{t.autoContinue}</FieldLabel>
                <FieldDescription>{t.autoContinueHelp}</FieldDescription>
              </FieldContent>
            </Field>
          </FieldGroup>
          </ScrollArea>
        </div>

        <DialogFooter className="sm:items-center">
          <Button variant="outline" onClick={onOpenSettings}>
            {t.settings}
          </Button>
          <Button disabled={!canStart || isStarting} onClick={onStart}>
            {t.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
