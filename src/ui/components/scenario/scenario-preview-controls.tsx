/**
 * Purpose: Edit basic and advanced launch options for a finished scenario.
 * Pattern: Controlled form composition.
 * Usage: Rendered by ScenarioPreviewPage.
 * Related: src/ui/pages/scenario-preview-page.tsx
 */
import { MultiverseOptions } from "@/ui/components/multiverse/multiverse-options"
import type { PromptOutputLength } from "@/shared"
import type { ScenarioDraft } from "@/ui/types/scenario"
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

export function ScenarioPreviewControls({ draft, onDraftChange, autoContinue, onAutoContinueChange, isStarting, startError, t }: {
  draft: ScenarioDraft; onDraftChange: (draft: ScenarioDraft) => void; autoContinue: boolean
  onAutoContinueChange: (value: boolean) => void; isStarting: boolean; startError?: boolean; t: UiTexts
}) {
  return (
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
                <details className="workspace-disclosure"><summary>{t.workspaceAdvanced}</summary><FieldGroup>
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
                </FieldGroup></details>
                <MultiverseOptions value={draft.multiverse} onChange={multiverse => onDraftChange({ ...draft, multiverse })} disabled={isStarting} t={t} />
                {startError ? <p role="alert" className="text-sm text-destructive">{t.builderRequestError}</p> : null}
              </FieldGroup>
  )
}
