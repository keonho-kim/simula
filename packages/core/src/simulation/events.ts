import type { RunEvent } from "@simula/shared"

export async function emitNodeStarted(
  runId: string,
  nodeId: string,
  label: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "node.started", runId, timestamp: timestamp(), nodeId, label })
}

export async function emitNodeCompleted(
  runId: string,
  nodeId: string,
  label: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "node.completed", runId, timestamp: timestamp(), nodeId, label })
}

export function timestamp(): string {
  return new Date().toISOString()
}

