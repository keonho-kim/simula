/**
 * Purpose: Fetch JSON API responses with bounded request time and caller cancellation.
 * Pattern: Browser transport boundary.
 * Usage: Shared by document/scenario and world-preparation adapters.
 * Related: src/ui/api-client/scenario-builder.ts, src/ui/api-client/worlds.ts
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export class RequestJsonError extends Error {
  readonly status: number
  constructor(status: number) { super(`Request failed (${status}).`); this.status = status }
}

export function unavailableServerArtifact(error: unknown): boolean {
  return error instanceof TypeError || error instanceof RequestJsonError && error.status === 404
}

export async function requestJson(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const response = await fetch(path, { ...init, signal })
  if (!response.ok) throw new RequestJsonError(response.status)
  return response.json()
}
