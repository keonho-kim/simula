import type { Dispatch, SetStateAction } from "react"
import type { LLMSettings, ModelProvider } from "@/shared"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/ui/components/ui/field"
import { Input } from "@/ui/components/ui/input"
import { Switch } from "@/ui/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs"
import type { UiTexts } from "@/ui/types/i18n"
import { isOpenAICompatible, providerDefaults, providerLabel, providers } from "@/ui/models/settings/settings-options"
import { JsonTextarea } from "@/ui/components/settings/form-fields"
import { patchProvider } from "@/ui/models/settings/draft-updates"
import { updateProviderJsonDraft } from "@/ui/models/settings/json-draft"
import type { ProviderJsonDraft } from "@/ui/types/settings"

export function ProviderSettingsPanel({ settings, jsonDraft, t, setDraft, setJsonDraft }: {
  settings: LLMSettings
  jsonDraft: ProviderJsonDraft
  t: UiTexts
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
  setJsonDraft: Dispatch<SetStateAction<ProviderJsonDraft>>
}) {
  return (
    <Tabs defaultValue={providers[0]?.value} className="min-w-0 gap-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start">
        {providers.map((provider) => (
          <TabsTrigger key={provider.value} value={provider.value}>
            {provider.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {providers.map((provider) => (
        <TabsContent key={provider.value} value={provider.value}>
          <ProviderSection
            provider={provider.value}
            settings={settings}
            jsonDraft={jsonDraft}
            t={t}
            setDraft={setDraft}
            setJsonDraft={setJsonDraft}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function ProviderSection({ provider, settings, jsonDraft, t, setDraft, setJsonDraft }: {
  provider: ModelProvider
  settings: LLMSettings
  jsonDraft: ProviderJsonDraft
  t: UiTexts
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
  setJsonDraft: Dispatch<SetStateAction<ProviderJsonDraft>>
}) {
  const active = settings.providers[provider]
  return (
    <FieldGroup className="gap-4">
      <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
        <FieldTitle>{providerLabel(provider)}</FieldTitle>
        <div className="grid gap-3 pt-3">
          {isOpenAICompatible(provider) ? (
            <Field>
              <FieldLabel>{t.settingsBaseUrl}</FieldLabel>
              <Input
                value={active.baseUrl ?? ""}
                placeholder={providerDefaults[provider]?.baseUrl}
                onChange={(event) => patchProvider(provider, { baseUrl: event.target.value }, setDraft)}
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel>{t.settingsApiKey}</FieldLabel>
            <Input
              type="password"
              value={active.apiKey ?? ""}
              placeholder={isOpenAICompatible(provider) ? t.settingsOptionalLocalServers : t.settingsRequired}
              onChange={(event) => patchProvider(provider, { apiKey: event.target.value }, setDraft)}
            />
          </Field>
          <Field orientation="horizontal" className="items-center justify-between rounded-md border border-border/70 px-3 py-2">
            <div>
              <FieldLabel>{t.settingsStreamUsage}</FieldLabel>
              <p className="text-xs text-muted-foreground">{t.settingsStreamUsageDescription}</p>
            </div>
            <Switch
              checked={active.streamUsage ?? true}
              onCheckedChange={(checked) => patchProvider(provider, { streamUsage: checked }, setDraft)}
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
        <FieldLegend>{t.settingsConnectionExtras}</FieldLegend>
        <div className="grid gap-3 pt-3">
          <JsonTextarea
            label={t.settingsExtraHeaders}
            value={jsonDraft[provider].extraHeaders}
            placeholder={'{\n  "X-Custom-Header": "value"\n}'}
            onChange={(value) => updateProviderJsonDraft(provider, "extraHeaders", value, setJsonDraft)}
          />
        </div>
      </FieldSet>
    </FieldGroup>
  )
}

