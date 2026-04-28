import type { ModelProvider, ModelRole, ProviderSettings, RoleSettings } from "@simula/shared"

export const roles: ModelRole[] = ["storyBuilder", "planner", "generator", "coordinator", "actor", "observer", "repair"]
export const cspProviders: Array<{ value: ModelProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
]
export const openAICompatibleProviders: Array<{ value: ModelProvider; label: string }> = [
  { value: "ollama", label: "ollama" },
  { value: "lmstudio", label: "lmstudio" },
  { value: "vllm", label: "vllm" },
  { value: "litellm", label: "litellm" },
]
export const providers = [...cspProviders, ...openAICompatibleProviders]
export const compatibleProviders: ModelProvider[] = ["ollama", "lmstudio", "vllm", "litellm"]
export const roleLabels: Record<ModelRole, string> = {
  storyBuilder: "Story Builder",
  planner: "Planner",
  generator: "Generator",
  coordinator: "Coordinator",
  actor: "Actor",
  observer: "Observer",
  repair: "Repair",
}
export const roleProviderDefaults: Partial<Record<ModelProvider, Partial<RoleSettings>>> = {
  gemini: { model: "gemini-2.5-pro" },
  ollama: { model: "llama3.1" },
  lmstudio: { model: "local-model", reasoningEffort: "medium" },
  vllm: { model: "local-model" },
  litellm: { model: "openai/gpt-5.4-mini" },
}
export const providerDefaults: Partial<Record<ModelProvider, ProviderSettings>> = {
  ollama: { baseUrl: "http://localhost:11434/v1", apiKey: "ollama", streamUsage: true },
  lmstudio: { baseUrl: "http://localhost:1234/v1", apiKey: "lm-studio", streamUsage: true },
  vllm: { baseUrl: "http://localhost:8000/v1", apiKey: "vllm", streamUsage: true },
  litellm: { baseUrl: "http://localhost:4000/v1", streamUsage: true },
}
export const extraBodyExamples: Partial<Record<ModelProvider, string>> = {
  ollama: '{\n  "num_ctx": 8192\n}',
  lmstudio: '{\n  "reasoning_effort": "medium"\n}',
  vllm: '{\n  "top_k": 50,\n  "min_p": 0.05,\n  "repetition_penalty": 1.05\n}',
  litellm: '{\n  "drop_params": true\n}',
}
export const safetySettingsExample = '[\n  { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }\n]'

export function isOpenAICompatible(provider: ModelProvider): boolean {
  return compatibleProviders.includes(provider)
}

export function supportsReasoningEffort(provider: ModelProvider): boolean {
  return provider === "openai" || provider === "lmstudio" || provider === "vllm" || provider === "litellm"
}

export function providerLabel(provider: ModelProvider): string {
  return providers.find((item) => item.value === provider)?.label ?? provider
}

