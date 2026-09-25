/**
 * Purpose: Review a finished scenario in a guarded, bounded editing popup.
 * Pattern: Controlled dialog component.
 * Usage: Lazy-loaded by src/ui/shell/App.tsx before run creation.
 * Related: src/ui/shell/home-view.tsx, src/ui/browser-storage/database/drafts/save.ts
 */
import { useState } from "react"
import { XIcon } from "lucide-react"
import type { PromptOutputLength } from "@/shared"
import type { ScenarioDraft } from "@/ui/types/scenario"
import { Button } from "@/ui/components/ui/button"
import { UnsavedChangesDialog } from "@/ui/components/ui/unsaved-changes-dialog"
import { saveDraft } from "@/ui/browser-storage/database/drafts/save"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/ui/components/ui/field"
import { Input } from "@/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select"
import { Switch } from "@/ui/components/ui/switch"
import type { UiTexts } from "@/ui/types/i18n"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

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
  onDraftSaved: () => void
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
  onDraftSaved,
}: ScenarioPreviewDialogProps) {
  const canStart = draft.text.trim().length > 0 && draft.controls.numCast > 0
  const [initial] = useState(() => ({ draft, autoContinue }))
  const [confirmClose, setConfirmClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const dirty = JSON.stringify([draft, autoContinue]) !== JSON.stringify([initial.draft, initial.autoContinue])
  const requestClose = () => {
    if (saving) return
    if (dirty) { setConfirmClose(true); setSaveError(undefined); return }
    onOpenChange(false)
  }
  const saveAndClose = async () => {
    setSaving(true); setSaveError(undefined)
    try {
      await saveDraft("finished-scenario", "scenario-preview", { draft, autoContinue })
      onDraftSaved()
      setConfirmClose(false)
      onOpenChange(false)
    } catch (error) { setSaveError(error instanceof Error ? error.message : t.builderRequestError) }
    finally { setSaving(false) }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={next => { if (!next) requestClose() }}>
      <DialogContent className="editing-popup" showCloseButton={false}>
        <DialogHeader className="flex-row items-start gap-4">
          <div className="flex min-w-0 flex-col gap-2"><DialogTitle>{t.scenarioPreview}</DialogTitle>
          <DialogDescription>{t.scenarioPreviewDescription}</DialogDescription></div>
          <Button variant="ghost" size="icon" className="ml-auto shrink-0" aria-label={t.modalClose} onClick={requestClose}><XIcon /></Button>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t.scenarioText}</h3>
                <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                  {draft.sourceName}
                </p>
              </div>
              <div className="rounded-md bg-background/70 p-4 ring-1 ring-border/60">
                <MarkdownContent content={draft.text} />
              </div>
            </div>

            <div className="min-w-0 flex-1">
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
                  <FieldLabel htmlFor="preview-output-length">
                    {t.outputLength}
                  </FieldLabel>
                  <Select
                    value={draft.controls.outputLength ?? "short"}
                    onValueChange={(outputLength) =>
                      onDraftChange({
                        ...draft,
                        controls: {
                          ...draft.controls,
                          outputLength: outputLength as PromptOutputLength,
                        },
                      })
                    }
                  >
                    <SelectTrigger id="preview-output-length" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="short">{t.outputLengthShort}</SelectItem>
                        <SelectItem value="medium">{t.outputLengthMedium}</SelectItem>
                        <SelectItem value="long">{t.outputLengthLong}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>{t.outputLengthHelp}</FieldDescription>
                </Field>
                <FieldGroup className="flex-row flex-wrap gap-3 [&>*]:min-w-[220px] [&>*]:flex-[1_1_220px] [&>*]:w-auto">
                  <Field
                    orientation="horizontal"
                    className="items-start rounded-md bg-muted/40 p-3"
                  >
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
                      <FieldLabel htmlFor="preview-allow-cast">
                        {t.allowExtraCast}
                      </FieldLabel>
                      <FieldDescription>
                        {t.allowExtraCastHelp}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                  <Field
                    orientation="horizontal"
                    className="items-start rounded-md bg-muted/40 p-3"
                  >
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
                      <FieldLabel htmlFor="preview-fast-mode">
                        {t.fastMode}
                      </FieldLabel>
                      <FieldDescription>{t.fastModeHelp}</FieldDescription>
                    </FieldContent>
                  </Field>
                  <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
                    <Switch
                      id="preview-autonomous-progress"
                      checked={draft.controls.autonomousProgress ?? false}
                      onCheckedChange={(autonomousProgress) => onDraftChange({ ...draft, controls: { ...draft.controls, autonomousProgress } })}
                      aria-describedby="preview-autonomous-progress-help"
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="preview-autonomous-progress">{t.autonomousProgress}</FieldLabel>
                      <FieldDescription id="preview-autonomous-progress-help">{t.autonomousProgressHelp}</FieldDescription>
                    </FieldContent>
                  </Field>
                  <Field
                    orientation="horizontal"
                    className="items-start rounded-md bg-muted/40 p-3"
                  >
                    <Switch
                      id="preview-auto-continue"
                      checked={autoContinue}
                      onCheckedChange={onAutoContinueChange}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="preview-auto-continue">
                        {t.autoContinue}
                      </FieldLabel>
                      <FieldDescription>
                        {t.autoContinueHelp}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>
              </FieldGroup>
            </div>
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
    <UnsavedChangesDialog open={confirmClose} busy={saving} error={saveError} t={t}
      onSave={() => void saveAndClose()}
      onDiscard={() => { onDraftChange(initial.draft); onAutoContinueChange(initial.autoContinue); setConfirmClose(false); onOpenChange(false) }}
      onContinue={() => setConfirmClose(false)} />
    </>
  )
}
