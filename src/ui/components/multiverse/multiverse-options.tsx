/**
 * Purpose: Collect the optional world count consistently before scenario creation or launch.
 * Pattern: Controlled form component.
 * Usage: Rendered by scenario setup and completed scenario previews.
 * Related: src/ui/models/scenario-builder/launch-options.ts
 */
import { useId } from "react"
import { MAX_BATCH_WORLDS } from "@/shared/multiverse"
import type { UiTexts } from "@/ui/types/i18n"
import { DEFAULT_MULTIVERSE, validMultiverse, type MultiverseOptions as Options } from "@/ui/models/scenario-builder/launch-options"
import { Input } from "@/ui/components/ui/input"
import { Field, FieldDescription, FieldLabel } from "@/ui/components/ui/field"

export function MultiverseOptions({ value = DEFAULT_MULTIVERSE, onChange, disabled, t }: {
  value?: Options; onChange: (value: Options) => void; disabled?: boolean; t: UiTexts
}) {
  const id = useId()
  return <div className="flex min-w-0 flex-col gap-3">
    <Field orientation="horizontal">
      <input id={id} type="checkbox" className="size-4 shrink-0 accent-primary" checked={value.enabled} disabled={disabled}
        onChange={event => onChange({ ...value, enabled: event.target.checked })} />
      <FieldLabel htmlFor={id}>{t.batchTitle}</FieldLabel>
    </Field>
    <FieldDescription>{t.batchSetupHelp}</FieldDescription>
    {value.enabled ? <Field>
      <FieldLabel htmlFor={`${id}-count`}>{t.batchWorldCount}</FieldLabel>
      <Input id={`${id}-count`} type="number" min={1} max={MAX_BATCH_WORLDS} step={1} required disabled={disabled}
        value={Number.isFinite(value.worldCount) ? value.worldCount : ""} aria-invalid={!validMultiverse(value)}
        onChange={event => onChange({ ...value, worldCount: event.currentTarget.valueAsNumber })} />
      <FieldDescription>{t.batchWorldCountHelp.replace("{maximum}", String(MAX_BATCH_WORLDS))}</FieldDescription>
    </Field> : null}
  </div>
}
