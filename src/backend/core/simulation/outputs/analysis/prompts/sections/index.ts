/**
 * Purpose: Expose the cohesive instruction set for this prompt family.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
import { instruction as actors } from "./actors"
import { instruction as conclusion } from "./conclusion"
import { instruction as materials } from "./materials"
import { instruction as opportunities } from "./opportunities"
import { instruction as scenario } from "./scenario"
import { instruction as strengths } from "./strengths"
import { instruction as threats } from "./threats"
import { instruction as trajectories } from "./trajectories"
import { instruction as weaknesses } from "./weaknesses"

export const sectionInstructions = { strengths, weaknesses, opportunities, threats, trajectories, actors, materials, scenario, conclusion } as const
