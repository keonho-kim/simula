/**
 * Purpose: Derive a common trajectory vocabulary and count mutually exclusive world classifications.
 * Pattern: Parallel proposal tree, classification frontier, and deterministic aggregation.
 * Usage: Called by the report trajectory branch after accepted world summaries exist.
 * Related: src/backend/core/simulation/outputs/analysis/contracts.ts, src/shared/analytical-report.ts
 */
import { trajectoryClassificationInstructions } from "./prompts/trajectory-classification"
import { trajectoryCountInstructions } from "./prompts/trajectory-count"
import { trajectoryLabelInstructions } from "./prompts/trajectory-label"
import { trajectoryDescriptionInstructions } from "./prompts/trajectory-description"
import { z } from "zod"
import type { TrajectoryDistribution } from "@/shared/analytical-report"
import type { PromptBlocks } from "@/backend/core/prompts/blocks"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import { analysisIdentity } from "./evidence"
import type { AnalysisTasks, WorldSummary } from "./contracts"

const GROUP_SIZE = 3
const categoriesSchema = z.object({ categories: z.array(z.object({ label: z.string().trim().min(1), description: z.string().trim().min(1) }).strict()).min(1).max(6) }).strict()

function normalizeCategories(categories: z.infer<typeof categoriesSchema>["categories"]) {
  const seen = new Set<string>()
  return categories.flatMap(category => {
    const label = category.label.slice(0, 100).trim()
    const description = category.description.slice(0, 300).trim()
    const key = label.normalize("NFKC").toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [{ label, description }]
  })
}

async function buildVocabulary(tasks: AnalysisTasks, id: string, stage: "proposal" | "merge",
  packet: PromptBlocks, evidenceIds: string[], maximum: number): Promise<z.infer<typeof categoriesSchema>> {
  const count = await tasks.run({ id: `${id}-count`, kind: "trajectory", schema: z.number().int().min(1).max(maximum),
    output: "choice", parse: (text: string) => {
      const answer = text.trim()
      if (!/^\d+$/.test(answer)) throw new Error("Choose one supplied trajectory count.")
      return Number(answer)
    },
    shape: `one category count from 1 to ${maximum}`, instruction: trajectoryCountInstructions(stage),
    input: packet, evidenceIds })
  const categories: z.infer<typeof categoriesSchema>["categories"] = []
  for (let index = 0; index < count; index++) {
    const label = await tasks.run({ id: `${id}-label-${index + 1}`, kind: "trajectory",
      schema: categoriesSchema.shape.categories.element.shape.label, output: "text",
      parse: (text: string) => text.trim(), shape: "one short distinct trajectory label",
      instruction: trajectoryLabelInstructions(stage),
      input: { ...packet, PREVIOUS_RESULT: { acceptedCategories: categories } }, evidenceIds })
    const description = await tasks.run({ id: `${id}-description-${index + 1}`, kind: "trajectory",
      schema: categoriesSchema.shape.categories.element.shape.description, output: "text",
      parse: (text: string) => text.trim(), shape: "one short causal-order description",
      instruction: trajectoryDescriptionInstructions,
      input: { ...packet, PREVIOUS_RESULT: { acceptedCategories: categories, label } }, evidenceIds })
    categories.push({ label, description })
  }
  const vocabulary = categoriesSchema.parse({ categories: normalizeCategories(categories) })
  await tasks.dependencies.saveTask({ id, fingerprint: JSON.stringify(vocabulary), value: vocabulary, attempt: 0 })
  return vocabulary
}

export async function classifyTrajectories(tasks: AnalysisTasks, worlds: WorldSummary[]): Promise<TrajectoryDistribution> {
  if (!worlds.length) return { categories: [], unclassifiedWorldIds: [] }
  const groups = Array.from({ length: Math.ceil(worlds.length / GROUP_SIZE) }, (_, index) => worlds.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE))
  let proposals = await mapGenerationTasks(groups, tasks.request.fastMode, async (group, index) => {
    return buildVocabulary(tasks, `trajectory-proposal-${index}`, "proposal",
      { SIMULATION: { worlds: group.map(value => ({ worldId: value.world.id, ...value.summary })) } },
      group.flatMap(value => value.summary.evidenceIds), Math.min(GROUP_SIZE, group.length))
  })
  for (let depth = 0; proposals.length > 1; depth++) {
    const packets = Array.from({ length: Math.ceil(proposals.length / GROUP_SIZE) }, (_, index) => proposals.slice(index * GROUP_SIZE, (index + 1) * GROUP_SIZE))
    proposals = await mapGenerationTasks(packets, tasks.request.fastMode, async (group, index) => {
      return buildVocabulary(tasks, `trajectory-vocabulary-${depth}-${index}`, "merge",
        { ANALYSIS: { categories: group } }, [], Math.min(6, group.flatMap(value => value.categories).length))
    })
  }
  const categories = proposals[0].categories.map((category, index) => ({ ...category, id: `trajectory-${index + 1}`, worldIds: [] as string[] }))
  const selection = z.number().int().min(0).max(categories.length)
  const results = await mapGenerationTasks(worlds, tasks.request.fastMode, async world => {
    const value = await tasks.run({ id: `trajectory-world-${analysisIdentity(world.world.id)}`, kind: "trajectory", output: "choice", schema: selection,
      parse: text => {
        const answer = text.trim()
        if (!/^\d+$/.test(answer)) throw new Error("Return one category index only.")
        return Number(answer)
      },
      shape: `one category index: 0 = unclassified; ${categories.map((category, index) => `${index + 1} = ${category.label}`).join("; ")}`,
      instruction: trajectoryClassificationInstructions,
      input: { OPTIONS: { categories: categories.map(({ label, description }, index) => ({ index: index + 1, label, description })) }, SIMULATION: { world: world.summary } }, evidenceIds: world.summary.evidenceIds,
    })
    return { worldId: world.world.id, categoryId: value === 0 ? null : categories[value - 1].id }
  })
  return aggregateTrajectories(categories, results)
}

export function aggregateTrajectories(categories: TrajectoryDistribution["categories"], assignments: Array<{ worldId: string; categoryId: string | null }>): TrajectoryDistribution {
  const grouped = categories.map(category => ({ ...category, worldIds: [] as string[] }))
  const unclassifiedWorldIds: string[] = []
  const seen = new Set<string>()
  for (const assignment of assignments) {
    if (seen.has(assignment.worldId)) throw new Error("A world can contribute only one headline trajectory.")
    seen.add(assignment.worldId)
    const category = grouped.find(value => value.id === assignment.categoryId)
    if (assignment.categoryId !== null && !category) throw new Error("Unknown trajectory category.")
    if (category) category.worldIds.push(assignment.worldId)
    else unclassifiedWorldIds.push(assignment.worldId)
  }
  return { categories: grouped.filter(category => category.worldIds.length > 0), unclassifiedWorldIds }
}
