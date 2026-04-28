import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"
import type { LLMSettings, ModelProvider, ModelRole, RoleSettings } from "@simula/shared"
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
import { Textarea } from "@/components/ui/textarea"
import { fetchSettings, saveSettings } from "@/lib/api"
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
const roleLabels: Record<ModelRole, string> = {
  storyBuilder: "Story Builder",
  planner: "Planner",
  generator: "Generator",
  coordinator: "Coordinator",
  actor: "Actor",
  observer: "Observer",
  repair: "Repair",
}
const compatibleProviders: ModelProvider[] = ["ollama", "lmstudio", "vllm", "litellm"]
const providerDefaults: Partial<Record<ModelProvider, Partial<RoleSettings>>> = {
  gemini: { model: "gemini-2.5-pro" },
  ollama: { model: "llama3.1", baseUrl: "http://localhost:11434/v1", apiKey: "ollama", streamUsage: false },
  lmstudio: {
    model: "local-model",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "lm-studio",
    streamUsage: false,
    reasoningEffort: "medium",
  },
  vllm: { model: "local-model", baseUrl: "http://localhost:8000/v1", apiKey: "vllm", streamUsage: true },
  litellm: { model: "openai/gpt-5.4-mini", baseUrl: "http://localhost:4000/v1", streamUsage: false },
}
const extraBodyExamples: Partial<Record<ModelProvider, string>> = {
  ollama: '{\n  "num_ctx": 8192\n}',
  lmstudio: '{\n  "reasoning_effort": "medium"\n}',
  vllm: '{\n  "top_k": 50,\n  "min_p": 0.05,\n  "repetition_penalty": 1.05\n}',
  litellm: '{\n  "drop_params": true\n}',
}
const safetySettingsExample = '[\n  { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }\n]'

type JsonField = "extraBody" | "extraHeaders" | "safetySettings"
type JsonDraft = Record<ModelRole, Record<JsonField, string>>

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [draft, setDraft] = useState<LLMSettings | undefined>()
  const [selectedRole, setSelectedRole] = useState<ModelRole>("storyBuilder")
  const [jsonDraft, setJsonDraft] = useState<JsonDraft>(() => emptyJsonDraft())
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings })
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (settings) => {
      setDraft(settings)
      setJsonDraft(buildJsonDraft(settings))
      toast.success("Settings saved")
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save settings"),
  })

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    const next = structuredClone(settingsQuery.data)
    setDraft(next)
    setJsonDraft(buildJsonDraft(next))
  }, [settingsQuery.data])

  const active = draft?.[selectedRole]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] gap-4 overflow-hidden sm:max-w-[1120px]">
        <DialogHeader>
          <DialogTitle>LLM settings</DialogTitle>
          <DialogDescription>
            Role-based model settings. API keys are sent to the server and are not displayed after save.
          </DialogDescription>
        </DialogHeader>

        {draft && active ? (
          <div className="grid min-h-0 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-2">
              <div className="px-2 pb-2 text-xs font-medium uppercase text-muted-foreground">Roles</div>
              <div className="grid gap-1">
                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={cn(
                      "rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      role === selectedRole
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/70"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    )}
                    onClick={() => setSelectedRole(role)}
                  >
                    <div className="font-medium">{roleLabels[role]}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {providerLabel(draft[role].provider)} · {draft[role].model || "No model"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <ScrollArea className="max-h-[66svh] pr-3">
              <FieldGroup className="gap-4">
                <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
                  <FieldTitle>{roleLabels[selectedRole]}</FieldTitle>
                  <div className="grid gap-3 pt-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Provider</FieldLabel>
                      <Select
                        value={active.provider}
                        onValueChange={(value) =>
                          updateRole(selectedRole, applyProviderDefaults(active, value as ModelProvider), setDraft)
                        }
                      >
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
                    </Field>
                    <Field>
                      <FieldLabel>Model</FieldLabel>
                      <Input value={active.model} onChange={(event) => patchRole(selectedRole, { model: event.target.value }, setDraft)} />
                    </Field>
                    {isOpenAICompatible(active.provider) ? (
                      <Field>
                        <FieldLabel>Base URL</FieldLabel>
                        <Input
                          value={active.baseUrl ?? ""}
                          placeholder={providerDefaults[active.provider]?.baseUrl}
                          onChange={(event) => patchRole(selectedRole, { baseUrl: event.target.value }, setDraft)}
                        />
                      </Field>
                    ) : null}
                    <Field>
                      <FieldLabel>API key</FieldLabel>
                      <Input
                        type="password"
                        value={active.apiKey ?? ""}
                        placeholder={isOpenAICompatible(active.provider) ? "Optional for local servers" : "Required"}
                        onChange={(event) => patchRole(selectedRole, { apiKey: event.target.value }, setDraft)}
                      />
                    </Field>
                  </div>
                </FieldSet>

                <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
                  <FieldLegend>Generation</FieldLegend>
                  <div className="grid gap-3 pt-3 md:grid-cols-3">
                    <NumberField label="Temperature" value={active.temperature} step="0.1" onChange={(value) => patchRole(selectedRole, { temperature: value }, setDraft)} />
                    <NumberField label="Max tokens" value={active.maxTokens} onChange={(value) => patchRole(selectedRole, { maxTokens: value }, setDraft)} />
                    <NumberField label="Timeout seconds" value={active.timeoutSeconds} onChange={(value) => patchRole(selectedRole, { timeoutSeconds: value }, setDraft)} />
                    {selectedRole === "actor" ? (
                      <NumberField label="Context token budget" value={active.contextTokenBudget ?? 2000} onChange={(value) => patchRole(selectedRole, { contextTokenBudget: value }, setDraft)} />
                    ) : null}
                    <OptionalNumberField label="Top P" value={active.topP} step="0.05" onChange={(value) => patchRole(selectedRole, { topP: value }, setDraft)} />
                    {active.provider === "gemini" ? (
                      <OptionalNumberField label="Top K" value={active.topK} onChange={(value) => patchRole(selectedRole, { topK: value }, setDraft)} />
                    ) : null}
                    {active.provider !== "anthropic" && active.provider !== "gemini" ? (
                      <>
                        <OptionalNumberField label="Frequency penalty" value={active.frequencyPenalty} step="0.1" onChange={(value) => patchRole(selectedRole, { frequencyPenalty: value }, setDraft)} />
                        <OptionalNumberField label="Presence penalty" value={active.presencePenalty} step="0.1" onChange={(value) => patchRole(selectedRole, { presencePenalty: value }, setDraft)} />
                        <OptionalNumberField label="Seed" value={active.seed} onChange={(value) => patchRole(selectedRole, { seed: value }, setDraft)} />
                      </>
                    ) : null}
                    {supportsReasoningEffort(active.provider) ? (
                      <Field>
                        <FieldLabel>Reasoning effort</FieldLabel>
                        <Select
                          value={active.reasoningEffort ?? "none"}
                          onValueChange={(value) =>
                            patchRole(
                              selectedRole,
                              { reasoningEffort: value === "none" ? undefined : value as RoleSettings["reasoningEffort"] },
                              setDraft
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : null}
                    <Field orientation="horizontal" className="items-center justify-between rounded-md border border-border/70 px-3 py-2">
                      <div>
                        <FieldLabel>Stream usage</FieldLabel>
                        <p className="text-xs text-muted-foreground">Request token usage in streamed chunks.</p>
                      </div>
                      <Switch
                        checked={active.streamUsage ?? true}
                        onCheckedChange={(checked) => patchRole(selectedRole, { streamUsage: checked }, setDraft)}
                      />
                    </Field>
                  </div>
                </FieldSet>

                {isOpenAICompatible(active.provider) || active.provider === "gemini" ? (
                  <FieldSet className="rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
                    <FieldLegend>Provider extras</FieldLegend>
                    <div className="grid gap-3 pt-3 xl:grid-cols-2">
                      {isOpenAICompatible(active.provider) ? (
                        <>
                          <JsonTextarea
                            label="Extra body"
                            value={jsonDraft[selectedRole].extraBody}
                            placeholder={extraBodyExamples[active.provider]}
                            onChange={(value) => updateJsonDraft(selectedRole, "extraBody", value, setJsonDraft)}
                          />
                          <JsonTextarea
                            label="Extra headers"
                            value={jsonDraft[selectedRole].extraHeaders}
                            placeholder={'{\n  "X-Custom-Header": "value"\n}'}
                            onChange={(value) => updateJsonDraft(selectedRole, "extraHeaders", value, setJsonDraft)}
                          />
                        </>
                      ) : null}
                      {active.provider === "gemini" ? (
                        <JsonTextarea
                          label="Safety settings"
                          value={jsonDraft[selectedRole].safetySettings}
                          placeholder={safetySettingsExample}
                          onChange={(value) => updateJsonDraft(selectedRole, "safetySettings", value, setJsonDraft)}
                        />
                      ) : null}
                    </div>
                  </FieldSet>
                ) : null}
              </FieldGroup>
            </ScrollArea>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Loading settings...</div>
        )}

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button disabled={!draft || saveMutation.isPending} onClick={() => draft && saveDraft(draft, jsonDraft, saveMutation.mutate)}>
            <SaveIcon data-icon="inline-start" />
            Save settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NumberField({ label, value, step, onChange }: {
  label: string
  value: number
  step?: string
  onChange: (value: number) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  )
}

function OptionalNumberField({ label, value, step, onChange }: {
  label: string
  value: number | undefined
  step?: string
  onChange: (value: number | undefined) => void
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
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

function saveDraft(draft: LLMSettings, jsonDraft: JsonDraft, save: (settings: LLMSettings) => void): void {
  try {
    const next = structuredClone(draft)
    for (const role of roles) {
      next[role].extraBody = parseObjectJson(jsonDraft[role].extraBody, `${role} extra body`)
      next[role].extraHeaders = parseHeadersJson(jsonDraft[role].extraHeaders, `${role} extra headers`)
      next[role].safetySettings = parseArrayJson(jsonDraft[role].safetySettings, `${role} safety settings`)
    }
    save(next)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Invalid settings")
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

function emptyJsonDraft(): JsonDraft {
  return Object.fromEntries(
    roles.map((role) => [role, { extraBody: "", extraHeaders: "", safetySettings: "" }])
  ) as JsonDraft
}

function buildJsonDraft(settings: LLMSettings): JsonDraft {
  return Object.fromEntries(
    roles.map((role) => [
      role,
      {
        extraBody: formatJson(settings[role].extraBody),
        extraHeaders: formatJson(settings[role].extraHeaders),
        safetySettings: formatJson(settings[role].safetySettings),
      },
    ])
  ) as JsonDraft
}

function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2)
}

function updateJsonDraft(
  role: ModelRole,
  field: JsonField,
  value: string,
  setJsonDraft: Dispatch<SetStateAction<JsonDraft>>
): void {
  setJsonDraft((current) => ({
    ...current,
    [role]: {
      ...current[role],
      [field]: value,
    },
  }))
}

function updateRole(
  role: ModelRole,
  value: RoleSettings,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && { ...current, [role]: value })
}

function patchRole(
  role: ModelRole,
  patch: Partial<RoleSettings>,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && { ...current, [role]: { ...current[role], ...patch } })
}

function applyProviderDefaults(config: RoleSettings, provider: ModelProvider): RoleSettings {
  return {
    ...config,
    ...providerDefaults[provider],
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
