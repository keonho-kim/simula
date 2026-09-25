/**
 * Purpose: Carry runtime-owned call admission and cancellation through asynchronous model workflows.
 * Pattern: Scoped execution context at an I/O boundary.
 * Usage: Runtime binds a context with runWithModelExecution; only invocation consumes it.
 * Related: src/backend/integrations/llm/invoke.ts, src/backend/runtime/model-admission.ts
 */
import { AsyncLocalStorage } from "node:async_hooks"
import type { ResolvedRoleSettings } from "@/shared/settings"
import type { ModelCallFailure } from "@/shared/model-failure"
import { isOpenAICompatibleProvider } from "@/backend/core/settings"

export interface ModelCallAdmission {
  acquire(pool: string, owner: string, signal?: AbortSignal): Promise<() => void>
}

export interface ModelExecution {
  readonly owner: string
  readonly admission: ModelCallAdmission
  readonly signal: AbortSignal
  readonly assertActive?: () => void
  readonly onModelCallFailure?: (failure: ModelCallFailure) => Promise<void>
}

// The composition root supplies one admission owner to independent runtime scopes;
// this context does not construct a global scheduler or provider registry.
const executionContext = new AsyncLocalStorage<ModelExecution>()

export function runWithModelExecution<T>(execution: ModelExecution, operation: () => T): T {
  execution.signal.throwIfAborted()
  return executionContext.run(execution, operation)
}

export function currentModelExecution(): ModelExecution | undefined {
  return executionContext.getStore()
}

export function modelResourcePool(config: ResolvedRoleSettings): string {
  const endpoint = isOpenAICompatibleProvider(config.provider)
    ? config.baseUrl ?? "https://api.openai.com/v1"
    : config.provider === "anthropic" ? "https://api.anthropic.com"
      : config.provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.openai.com/v1"
  const url = new URL(endpoint)
  // Credential rotation and equivalent provider aliases must not create extra slots.
  url.username = ""
  url.password = ""
  url.hash = ""
  url.search = ""
  return JSON.stringify([url.toString().replace(/\/+$/, ""), config.model])
}
