/**
 * Purpose: Insert a user-authored scenario separately from bundled samples.
 * Pattern: Repository Query.
 * Usage: Called when the user submits a scenario for a new run.
 * Related: src/ui/browser-storage/database/browser-schema.ts, src/ui/api-client/client.ts
 */
import type { ScenarioInput } from "@/shared"
import { scenarios } from "../browser-schema"
import { browserOrm } from "../orm"

export async function saveUserScenario(input: ScenarioInput, id = crypto.randomUUID()): Promise<string> {
  await browserOrm.insert(scenarios).values({ id, origin: "user", seedVersion: null,
    sourceName: input.sourceName ?? "Untitled scenario", text: input.text,
    controlsJson: JSON.stringify(input.controls), updatedAt: new Date().toISOString() })
  return id
}
