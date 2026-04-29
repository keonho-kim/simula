import type { ModelProvider, ModelRole } from "@simula/shared"

export const MODEL_ROLES: ModelRole[] = [
  "storyBuilder",
  "planner",
  "generator",
  "coordinator",
  "actor",
  "observer",
  "repair",
]

export const MODEL_PROVIDERS: ModelProvider[] = [
  "openai",
  "anthropic",
  "gemini",
  "ollama",
  "lmstudio",
  "vllm",
  "litellm",
]

export const OPENAI_COMPATIBLE_PROVIDERS: ModelProvider[] = ["ollama", "lmstudio", "vllm", "litellm"]
export const DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET = 400
export const MAX_ACTOR_CONTEXT_TOKEN_BUDGET = 400
