import type { Dispatch, SetStateAction } from "react"
import { AlertCircleIcon } from "lucide-react"
import type { LLMSettings, ModelRole, RoleSettings } from "@simula/shared"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { isOpenAICompatible } from "./constants"
import { patchRole } from "./state"

export function ModelField({ role, active, models, loading, error, t, setDraft }: {
  role: ModelRole
  active: RoleSettings
  models: string[]
  loading: boolean
  error: boolean
  t: UiTexts
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
}) {
  if (!isOpenAICompatible(active.provider)) {
    return (
      <Field>
        <FieldLabel>{t.settingsModel}</FieldLabel>
        <Input value={active.model} onChange={(event) => patchRole(role, { model: event.target.value }, setDraft)} />
      </Field>
    )
  }

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{t.settingsModel}</FieldLabel>
        {error ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircleIcon className="size-4 text-destructive" aria-label={t.settingsModelLoadingFailed} />
              </TooltipTrigger>
              <TooltipContent>{t.settingsModelLoadingFailedDescription}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
      <Select
        value={active.model}
        disabled={loading || error || models.length === 0}
        onValueChange={(value) => patchRole(role, { model: value }, setDraft)}
      >
        <SelectTrigger className={cn("w-full", error && "border-destructive text-destructive ring-destructive/20")}>
          <SelectValue placeholder={loading ? t.settingsLoadingModels : active.model || t.settingsNoModels} />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-xs text-destructive">{t.settingsModelLoadingFailedDescription}</p>
      ) : null}
    </Field>
  )
}

