import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { AlertCircleIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import type { LLMSettings, ModelProvider, ModelRole, ProviderSettings, RoleSettings } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchProviderModels, fetchSettings, saveSettings } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const roles: ModelRole[] = ["storyBuilder", "planner", "generator", "coordinator", "actor", "observer", "repair"]
const cspProviders: Array<{ value: ModelProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
]
const openAICompatibleProviders: Array<{ value: ModelProvider; label: string }> = [
  { value: "ollama", label: "ollama" },
  { value: "lmstudio", label: "lmstudio" },
  { value: "vllm", label: "vllm" },
  { value: "litellm", label: "litellm" },
]
const providers = [...cspProviders, ...openAICompatibleProviders]
const compatibleProviders: ModelProvider[] = ["ollama", "lmstudio", "vllm", "litellm"]
const roleLabels: Record<ModelRole, string> = {
  storyBuilder: "Story Builder",
  planner: "Planner",
  generator: "Generator",
  coordinator: "Coordinator",
  actor: "Actor",
  observer: "Observer",
  repair: "Repair",
}
const roleProviderDefaults: Partial<Record<ModelProvider, Partial<RoleSettings>>> = {
  gemini: { model: "gemini-2.5-pro" },
  ollama: { model: "llama3.1" },
  lmstudio: { model: "local-model", reasoningEffort: "medium" },
  vllm: { model: "local-model" },
  litellm: { model: "openai/gpt-5.4-mini" },
}
const providerDefaults: Partial<Record<ModelProvider, ProviderSettings>> = {
  ollama: { baseUrl: "http://localhost:11434/v1", apiKey: "ollama", streamUsage: true },
  lmstudio: { baseUrl: "http://localhost:1234/v1", apiKey: "lm-studio", streamUsage: true },
  vllm: { baseUrl: "http://localhost:8000/v1", apiKey: "vllm", streamUsage: true },
  litellm: { baseUrl: "http://localhost:4000/v1", streamUsage: true },
}
const extraBodyExamples: Partial<Record<ModelProvider, string>> = {
  ollama: '{\n  "num_ctx": 8192\n}',
  lmstudio: '{\n  "reasoning_effort": "medium"\n}',
  vllm: '{\n  "top_k": 50,\n  "min_p": 0.05,\n  "repetition_penalty": 1.05\n}',
  litellm: '{\n  "drop_params": true\n}',
}
const safetySettingsExample = '[\n  { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }\n]'

type SettingsPage = "providers" | "roles"
type RoleJsonField = "extraBody" | "safetySettings"
type ProviderJsonField = "extraHeaders"
type RoleJsonDraft = Record<ModelRole, Record<RoleJsonField, string>>
type ProviderJsonDraft = Record<ModelProvider, Record<ProviderJsonField, string>>

interface SettingsDialogProps {
  open: boolean
  t: UiTexts
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, t, onOpenChange }: SettingsDialogProps) {
  const [draft, setDraft] = useState<LLMSettings | undefined>()
  const [page, setPage] = useState<SettingsPage>("providers")
  const [roleJsonDraft, setRoleJsonDraft] = useState<RoleJsonDraft>(() => emptyRoleJsonDraft())
  const [providerJsonDraft, setProviderJsonDraft] = useState<ProviderJsonDraft>(() => emptyProviderJsonDraft())
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings })
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (settings) => {
      setDraft(settings)
      setRoleJsonDraft(buildRoleJsonDraft(settings))
      setProviderJsonDraft(buildProviderJsonDraft(settings))
      toast.success(t.settingsSavedToast)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t.settingsSaveFailedToast),
  })

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    const next = structuredClone(settingsQuery.data)
    setDraft(next)
    setRoleJsonDraft(buildRoleJsonDraft(next))
    setProviderJsonDraft(buildProviderJsonDraft(next))
  }, [settingsQuery.data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] gap-4 overflow-hidden sm:max-w-[1120px]">
        <DialogHeader>
          <DialogTitle>{t.settingsTitle}</DialogTitle>
          <DialogDescription>
            {t.settingsDescription}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="grid min-h-0 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
            <SettingsSidebar page={page} t={t} onSelect={setPage} />
            <ScrollArea className="max-h-[66svh] pr-3">
              {page === "providers" ? (
                <ProvidersPage
                  settings={draft}
                  jsonDraft={providerJsonDraft}
                  t={t}
                  setDraft={setDraft}
                  setJsonDraft={setProviderJsonDraft}
                />
              ) : (
                <RolesPage
                  settings={draft}
                  t={t}
                  setDraft={setDraft}
                  jsonDraft={roleJsonDraft}
                  setJsonDraft={setRoleJsonDraft}
                />
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">{t.settingsLoading}</div>
        )}

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button
            disabled={!draft || saveMutation.isPending}
            onClick={() => draft && saveDraft(draft, roleJsonDraft, providerJsonDraft, saveMutation.mutate, t)}
          >
            <SaveIcon data-icon="inline-start" />
            {t.settingsSave}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingsSidebar({ page, t, onSelect }: {
  page: SettingsPage
  t: UiTexts
  onSelect: (page: SettingsPage) => void
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/20 p-2">
      <SidebarButton
        active={page === "providers"}
        title={t.settingsProviders}
        subtitle={t.settingsProviderConnections}
        onClick={() => onSelect("providers")}
      />
      <SidebarButton
        active={page === "roles"}
        title={t.settingsRoles}
        subtitle={t.settingsRoleGeneration}
        onClick={() => onSelect("roles")}
      />
    </div>
  )
}

function SidebarButton({ active, title, subtitle, onClick }: {
  active: boolean
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
      )}
      onClick={onClick}
    >
      <div className="font-medium">{title}</div>
      <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
    </button>
  )
}

function ProvidersPage({ settings, jsonDraft, t, setDraft, setJsonDraft }: {
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

function RolesPage({ settings, t, setDraft, jsonDraft, setJsonDraft }: {
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

function ProviderSelect({ value, onChange }: { value: ModelProvider; onChange: (provider: ModelProvider) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ModelProvider)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>CSP</SelectLabel>
          {cspProviders.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>OpenAI Compatible</SelectLabel>
          {openAICompatibleProviders.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function ModelField({ role, active, models, loading, error, t, setDraft }: {
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

function NumberField({ label, value, step, onChange }: {
  label: string
  value: number
  step?: string
  onChange: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) {
      setText(String(value))
    }
  }, [editing, value])

  const commitText = (nextText: string) => {
    setText(nextText)
    if (!nextText.trim()) {
      return
    }
    const nextValue = Number(nextText)
    if (Number.isFinite(nextValue)) {
      onChange(nextValue)
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        step={step}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(event) => commitText(event.target.value)}
        onBlur={() => {
          setEditing(false)
          const nextValue = Number(text)
          setText(text.trim() && Number.isFinite(nextValue) ? String(nextValue) : String(value))
        }}
      />
    </Field>
  )
}

function OptionalNumberField({ label, value, step, onChange }: {
  label: string
  value: number | undefined
  step?: string
  onChange: (value: number | undefined) => void
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) {
      setText(value === undefined ? "" : String(value))
    }
  }, [editing, value])

  const commitText = (nextText: string) => {
    setText(nextText)
    if (!nextText.trim()) {
      onChange(undefined)
      return
    }
    const nextValue = Number(nextText)
    if (Number.isFinite(nextValue)) {
      onChange(nextValue)
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        step={step}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(event) => commitText(event.target.value)}
        onBlur={() => {
          setEditing(false)
          if (!text.trim()) {
            setText("")
            return
          }
          const nextValue = Number(text)
          setText(Number.isFinite(nextValue) ? String(nextValue) : value === undefined ? "" : String(value))
        }}
      />
    </Field>
  )
}

function JsonTextarea({ label, value, placeholder, onChange }: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        className="min-h-28 font-mono text-xs"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

function saveDraft(
  draft: LLMSettings,
  roleJsonDraft: RoleJsonDraft,
  providerJsonDraft: ProviderJsonDraft,
  save: (settings: LLMSettings) => void,
  t: UiTexts
): void {
  try {
    const next = structuredClone(draft)
    for (const provider of providers.map((item) => item.value)) {
      next.providers[provider].extraHeaders = parseHeadersJson(providerJsonDraft[provider].extraHeaders, `${provider} extra headers`)
    }
    for (const role of roles) {
      next.roles[role].extraBody = parseObjectJson(roleJsonDraft[role].extraBody, `${role} extra body`)
      next.roles[role].safetySettings = parseArrayJson(roleJsonDraft[role].safetySettings, `${role} safety settings`)
    }
    save(next)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t.settingsInvalidToast)
  }
}

function parseObjectJson(value: string, label: string): Record<string, unknown> | undefined {
  const parsed = parseJson(value, label)
  if (parsed === undefined) {
    return undefined
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed
}

function parseHeadersJson(value: string, label: string): Record<string, string> | undefined {
  const parsed = parseObjectJson(value, label)
  if (!parsed) {
    return undefined
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)]))
}

function parseArrayJson(value: string, label: string): Array<Record<string, string>> | undefined {
  const parsed = parseJson(value, label)
  if (parsed === undefined) {
    return undefined
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`)
  }
  return parsed.map((entry) => {
    if (!isPlainObject(entry)) {
      throw new Error(`${label} entries must be JSON objects.`)
    }
    return Object.fromEntries(Object.entries(entry).map(([key, settingValue]) => [key, String(settingValue)]))
  })
}

function parseJson(value: string, label: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`${label} is not valid JSON.`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function emptyRoleJsonDraft(): RoleJsonDraft {
  return Object.fromEntries(
    roles.map((role) => [role, { extraBody: "", safetySettings: "" }])
  ) as RoleJsonDraft
}

function emptyProviderJsonDraft(): ProviderJsonDraft {
  return Object.fromEntries(
    providers.map((provider) => [provider.value, { extraHeaders: "" }])
  ) as ProviderJsonDraft
}

function buildRoleJsonDraft(settings: LLMSettings): RoleJsonDraft {
  return Object.fromEntries(
    roles.map((role) => [
      role,
      {
        extraBody: formatJson(settings.roles[role].extraBody),
        safetySettings: formatJson(settings.roles[role].safetySettings),
      },
    ])
  ) as RoleJsonDraft
}

function buildProviderJsonDraft(settings: LLMSettings): ProviderJsonDraft {
  return Object.fromEntries(
    providers.map((provider) => [
      provider.value,
      {
        extraHeaders: formatJson(settings.providers[provider.value].extraHeaders),
      },
    ])
  ) as ProviderJsonDraft
}

function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2)
}

function updateRoleJsonDraft(
  role: ModelRole,
  field: RoleJsonField,
  value: string,
  setJsonDraft: Dispatch<SetStateAction<RoleJsonDraft>>
): void {
  setJsonDraft((current) => ({
    ...current,
    [role]: {
      ...current[role],
      [field]: value,
    },
  }))
}

function updateProviderJsonDraft(
  provider: ModelProvider,
  field: ProviderJsonField,
  value: string,
  setJsonDraft: Dispatch<SetStateAction<ProviderJsonDraft>>
): void {
  setJsonDraft((current) => ({
    ...current,
    [provider]: {
      ...current[provider],
      [field]: value,
    },
  }))
}

function updateRole(
  role: ModelRole,
  value: RoleSettings,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && { ...current, roles: { ...current.roles, [role]: value } })
}

function patchRole(
  role: ModelRole,
  patch: Partial<RoleSettings>,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && {
    ...current,
    roles: { ...current.roles, [role]: { ...current.roles[role], ...patch } },
  })
}

function patchProvider(
  provider: ModelProvider,
  patch: Partial<ProviderSettings>,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && {
    ...current,
    providers: { ...current.providers, [provider]: { ...current.providers[provider], ...patch } },
  })
}

function applyProviderDefaults(config: RoleSettings, provider: ModelProvider): RoleSettings {
  return {
    ...config,
    ...roleProviderDefaults[provider],
    provider,
  }
}

function isOpenAICompatible(provider: ModelProvider): boolean {
  return compatibleProviders.includes(provider)
}

function supportsReasoningEffort(provider: ModelProvider): boolean {
  return provider === "openai" || provider === "lmstudio" || provider === "vllm" || provider === "litellm"
}

function providerLabel(provider: ModelProvider): string {
  return providers.find((item) => item.value === provider)?.label ?? provider
}
