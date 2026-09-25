/**
 * Purpose: Select a bounded cast size and generate distinct participant names one at a time.
 * Pattern: Sequential generation use case.
 * Usage: Called by scenario-builder/design.ts when the user leaves the cast empty.
 * Related: src/backend/core/scenario-builder/prompts/roster/count.ts, src/shared/scenario-builder-schema.ts
 */
import { z } from "zod"
import { participantNameKey, rosterSchema, situationSchema } from "@/shared/scenario-builder-schema"
import { rosterCountInstructions } from "./prompts/roster/count"
import { rosterNameInstructions } from "./prompts/roster/name"
import type { BuilderTasks } from "./contracts"

const castCount = z.number().int().min(2).max(6)
function generatedRoleKey(name: string): string { return participantNameKey(name.replace(/^the\s+/i, "").replace(/[.!?]$/, "")) }

function parseRosterName(text: string): string {
  const name = text.trim()
  if (/[.!?]$/.test(name) || name.includes("\n") || name.split(/\s+/).length > 6) {
    throw new Error("Return only one person name or role title, without a sentence or explanation.")
  }
  return name
}

export async function buildRoster(tasks: BuilderTasks, situation: z.infer<typeof situationSchema>): Promise<string[]> {
  const count = await tasks.run({ id: "roster-count", kind: "roster", output: "choice", schema: castCount,
    parse: (text: string) => {
      const answer = text.trim()
      if (!/^[2-6]$/.test(answer)) throw new Error("Choose one cast size from 2 to 6.")
      return Number(answer)
    },
    shape: "one digit: 2, 3, 4, 5, or 6", instruction: rosterCountInstructions,
    input: { SCENARIO: { situation }, USER_INPUT: { context: tasks.request.context, preset: tasks.request.situation } },
    evidenceIds: situation.evidenceIds })
  const names: string[] = []
  for (let index = 0; index < count; index++) {
    const previous = new Set(names.map(generatedRoleKey))
    const name = await tasks.run({ id: `roster-name-${index + 1}`, kind: "roster", output: "text",
      schema: rosterSchema.shape.names.element.refine(value => !previous.has(generatedRoleKey(value)), "Choose a distinct participant name or role title."),
      parse: parseRosterName, shape: "one concise person name or role title, without a sentence or final period",
      instruction: rosterNameInstructions,
      input: { SCENARIO: { situation }, OPTIONS: { position: index + 1, total: count, acceptedNames: names } },
      evidenceIds: situation.evidenceIds })
    names.push(name)
  }
  const accepted = rosterSchema.parse({ names })
  await tasks.dependencies.saveTask({ id: "roster", fingerprint: JSON.stringify(accepted), value: accepted, attempt: 0 })
  return accepted.names
}
