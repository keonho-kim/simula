/**
 * Purpose: Render the shared simulation controls for individual and Multiverse preparation.
 * Pattern: Controlled form fields.
 * Usage: Placed inside the launch form's FieldGroup.
 * Related: src/ui/components/scenario-builder/world-launch.tsx, src/ui/components/multiverse/multiverse-panel.tsx
 */
import type { WorldControls } from "@/shared/world-preparation"
import type { UiTexts } from "@/ui/types/i18n"
import { Field, FieldDescription, FieldLabel } from "@/ui/components/ui/field"
import { Input } from "@/ui/components/ui/input"
import { Switch } from "@/ui/components/ui/switch"

export function WorldControlsFields({ controls, onChange, disabled, prefix, t }: {
  controls: WorldControls; onChange: (patch: Partial<WorldControls>) => void; disabled: boolean; prefix: string; t: UiTexts
}) {
  return <>
    <Field><FieldLabel htmlFor={`${prefix}-rounds`}>{t.maxRound}</FieldLabel><Input id={`${prefix}-rounds`} type="number" min={1} required disabled={disabled} value={controls.maxRound} onChange={event => onChange({ maxRound: Number(event.target.value) })} /><FieldDescription>{t.maxRoundHelp}</FieldDescription></Field>
    <Field><FieldLabel htmlFor={`${prefix}-actions`}>{t.actionsPerType}</FieldLabel><Input id={`${prefix}-actions`} type="number" min={1} required disabled={disabled} value={controls.actionsPerType} onChange={event => onChange({ actionsPerType: Number(event.target.value) })} /></Field>
    <Field orientation="horizontal"><FieldLabel htmlFor={`${prefix}-fast`}>{t.fastMode}</FieldLabel><Switch id={`${prefix}-fast`} checked={controls.fastMode} disabled={disabled} onCheckedChange={value => onChange({ fastMode: value })} /></Field>
    <Field orientation="horizontal"><FieldLabel htmlFor={`${prefix}-autonomous`}>{t.autonomousProgress}</FieldLabel><Switch id={`${prefix}-autonomous`} checked={controls.autonomousProgress} disabled={disabled} onCheckedChange={value => onChange({ autonomousProgress: value })} /></Field>
  </>
}
