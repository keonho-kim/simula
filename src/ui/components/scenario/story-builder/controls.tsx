/**
 * Purpose: Render and update scenario controls used while authoring a draft.
 * Pattern: Controlled form component.
 * Usage: Composed by the story-builder setup panel.
 * Related: src/shared/scenario.ts, src/ui/i18n/messages/common.ts
 */
import type { PromptOutputLength, ScenarioControls } from "@/shared"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select"
import { Switch } from "@/ui/components/ui/switch"
import type { UiTexts } from "@/ui/types/i18n"

interface StoryBuilderControlsProps {
  controls: ScenarioControls
  t: UiTexts
  onControlsChange: (controls: ScenarioControls) => void
}

export function StoryBuilderControls({
  controls,
  t,
  onControlsChange,
}: StoryBuilderControlsProps) {
  return (
    <FieldGroup className="gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <NumberControl
          id="builder-cast-size"
          label={t.castSize}
          value={controls.numCast}
          onChange={(numCast) => onControlsChange({ ...controls, numCast })}
        />
        <NumberControl
          id="builder-max-round"
          label={t.maxRound}
          value={controls.maxRound}
          onChange={(maxRound) => onControlsChange({ ...controls, maxRound })}
        />
        <NumberControl
          id="builder-actions-per-type"
          label={t.actionsPerType}
          value={controls.actionsPerType}
          onChange={(actionsPerType) => onControlsChange({ ...controls, actionsPerType })}
        />
        <Field>
          <FieldLabel htmlFor="builder-output-length">{t.outputLength}</FieldLabel>
          <Select
            value={controls.outputLength ?? "short"}
            onValueChange={(outputLength) =>
              onControlsChange({ ...controls, outputLength: outputLength as PromptOutputLength })
            }
          >
            <SelectTrigger id="builder-output-length" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">{t.outputLengthShort}</SelectItem>
              <SelectItem value="medium">{t.outputLengthMedium}</SelectItem>
              <SelectItem value="long">{t.outputLengthLong}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <FieldGroup className="gap-3 sm:grid sm:grid-cols-2">
        <BooleanControl
          id="builder-extra-cast"
          label={t.allowExtraCast}
          description={t.allowExtraCastHelp}
          checked={controls.allowAdditionalCast}
          onChange={(allowAdditionalCast) => onControlsChange({ ...controls, allowAdditionalCast })}
        />
        <BooleanControl
          id="builder-fast-mode"
          label={t.fastMode}
          description={t.fastModeHelp}
          checked={controls.fastMode}
          onChange={(fastMode) => onControlsChange({ ...controls, fastMode })}
        />
        <BooleanControl
          id="builder-autonomous-progress"
          label={t.autonomousProgress}
          description={t.autonomousProgressHelp}
          checked={controls.autonomousProgress ?? false}
          onChange={(autonomousProgress) => onControlsChange({ ...controls, autonomousProgress })}
        />
      </FieldGroup>
    </FieldGroup>
  )
}

function NumberControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="number" min={1} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  )
}

function BooleanControl({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const helpId = `${id}-help`
  return (
    <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={helpId} />
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription id={helpId}>{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}
