import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react"
import { useQuery } from "@tanstack/react-query"
import type { LLMSettings, ModelRole, RoleSettings } from "@simula/shared"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchProviderModels } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import {
  extraBodyExamples,
  isOpenAICompatible,
  roleLabels,
  roles,
  safetySettingsExample,
  supportsReasoningEffort,
} from "./constants"
import { JsonTextarea, NumberField, OptionalNumberField } from "./form-fields"
import { updateRoleJsonDraft } from "./json-draft"
import { ModelField } from "./model-field"
import { ProviderSelect } from "./provider-select"
import { applyProviderDefaults, patchRole, updateRole } from "./state"
import type { RoleJsonDraft } from "./types"

export function RolesPage({ settings, t, setDraft, jsonDraft, setJsonDraft }: {
  settings: LLMSettings
  t: UiTexts
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
  jsonDraft: RoleJsonDraft
  setJsonDraft: Dispatch<SetStateAction<RoleJsonDraft>>
}) {
  return (
    <Tabs defaultValue={roles[0]} className="min-w-0 gap-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start">
        {roles.map((role) => (
          <TabsTrigger key={role} value={role}>
            {roleLabels[role]}
          </TabsTrigger>
        ))}
      </TabsList>
      {roles.map((role) => (
        <TabsContent key={role} value={role}>
          <RoleSection
            role={role}
            settings={settings}
            t={t}
            setDraft={setDraft}
            jsonDraft={jsonDraft}
            setJsonDraft={setJsonDraft}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function RoleSection({ role, settings, t, setDraft, jsonDraft, setJsonDraft }: {
  role: ModelRole
  settings: LLMSettings
  t: UiTexts
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
  jsonDraft: RoleJsonDraft
  setJsonDraft: Dispatch<SetStateAction<RoleJsonDraft>>
}) {
  const active = settings.roles[role]
  const connection = settings.providers[active.provider]
  const modelsQuery = useQuery({
    queryKey: ["provider-models", role, active.provider, connection.baseUrl, connection.apiKey, connection.extraHeaders],
    queryFn: () => fetchProviderModels(active.provider, connection),
    enabled: false,
    retry: false,
  })
  const shouldLoadModels = isOpenAICompatible(active.provider)

  useEffect(() => {
    if (shouldLoadModels) {
      void modelsQuery.refetch()
    }
  }, [shouldLoadModels, role, active.provider])

  const models = useMemo(() => {
    const fetched = modelsQuery.data ?? []
    return active.model && !fetched.includes(active.model) ? [active.model, ...fetched] : fetched
  }, [active.model, modelsQuery.data])

  return (
    <FieldGroup className="gap-4">
      <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
        <FieldTitle>{roleLabels[role]}</FieldTitle>
        <div className="grid gap-3 pt-3">
          <Field>
            <FieldLabel>{t.settingsProvider}</FieldLabel>
            <ProviderSelect
              value={active.provider}
              onChange={(provider) => updateRole(role, applyProviderDefaults(active, provider), setDraft)}
            />
          </Field>
          <ModelField
            role={role}
            active={active}
            models={models}
            loading={shouldLoadModels && modelsQuery.isFetching}
            error={shouldLoadModels && modelsQuery.isError}
            t={t}
            setDraft={setDraft}
          />
        </div>
      </FieldSet>

      <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
        <FieldLegend>{t.settingsGeneration}</FieldLegend>
        <div className="grid gap-3 pt-3">
          <NumberField label={t.settingsTemperature} value={active.temperature} step="0.1" onChange={(value) => patchRole(role, { temperature: value }, setDraft)} />
          <NumberField label={t.settingsMaxTokens} value={active.maxTokens} onChange={(value) => patchRole(role, { maxTokens: value }, setDraft)} />
          <NumberField label={t.settingsTimeoutSeconds} value={active.timeoutSeconds} onChange={(value) => patchRole(role, { timeoutSeconds: value }, setDraft)} />
          <OptionalNumberField label={t.settingsTopP} value={active.topP} step="0.05" onChange={(value) => patchRole(role, { topP: value }, setDraft)} />
          {active.provider === "gemini" ? (
            <OptionalNumberField label={t.settingsTopK} value={active.topK} onChange={(value) => patchRole(role, { topK: value }, setDraft)} />
          ) : null}
          {active.provider !== "anthropic" && active.provider !== "gemini" ? (
            <>
              <OptionalNumberField label={t.settingsFrequencyPenalty} value={active.frequencyPenalty} step="0.1" onChange={(value) => patchRole(role, { frequencyPenalty: value }, setDraft)} />
              <OptionalNumberField label={t.settingsPresencePenalty} value={active.presencePenalty} step="0.1" onChange={(value) => patchRole(role, { presencePenalty: value }, setDraft)} />
              <OptionalNumberField label={t.settingsSeed} value={active.seed} onChange={(value) => patchRole(role, { seed: value }, setDraft)} />
            </>
          ) : null}
          {supportsReasoningEffort(active.provider) ? (
            <ReasoningEffortField active={active} role={role} t={t} setDraft={setDraft} />
          ) : null}
        </div>
      </FieldSet>

      {isOpenAICompatible(active.provider) || active.provider === "gemini" ? (
        <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
          <FieldLegend>{t.settingsProviderExtras}</FieldLegend>
          <div className="grid gap-3 pt-3">
            {isOpenAICompatible(active.provider) ? (
              <JsonTextarea
                label={t.settingsExtraBody}
                value={jsonDraft[role].extraBody}
                placeholder={extraBodyExamples[active.provider]}
                onChange={(value) => updateRoleJsonDraft(role, "extraBody", value, setJsonDraft)}
              />
            ) : null}
            {active.provider === "gemini" ? (
              <JsonTextarea
                label={t.settingsSafetySettings}
                value={jsonDraft[role].safetySettings}
                placeholder={safetySettingsExample}
                onChange={(value) => updateRoleJsonDraft(role, "safetySettings", value, setJsonDraft)}
              />
            ) : null}
          </div>
        </FieldSet>
      ) : null}
    </FieldGroup>
  )
}

function ReasoningEffortField({ active, role, t, setDraft }: {
  active: RoleSettings
  role: ModelRole
  t: UiTexts
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
}) {
  return (
    <Field>
      <FieldLabel>{t.settingsReasoningEffort}</FieldLabel>
      <Select
        value={active.reasoningEffort ?? "none"}
        onValueChange={(value) =>
          patchRole(
            role,
            { reasoningEffort: value === "none" ? undefined : value as RoleSettings["reasoningEffort"] },
            setDraft
          )
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t.settingsReasoningNone}</SelectItem>
          <SelectItem value="low">{t.settingsReasoningLow}</SelectItem>
          <SelectItem value="medium">{t.settingsReasoningMedium}</SelectItem>
          <SelectItem value="high">{t.settingsReasoningHigh}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}

