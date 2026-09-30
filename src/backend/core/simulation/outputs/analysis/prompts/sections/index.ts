/**
 * Purpose: Select the instructions for current simulation-development report sections.
 * Pattern: Prompt family boundary.
 * Usage: Used by finding and detail prompt builders.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts
 */
import { instruction as outcomes } from "./outcomes"
import { instruction as turningPoints } from "./turning-points"
import { instruction as actors } from "./actors"
import { instruction as conditions } from "./conditions"
import { instruction as implications } from "./implications"
import { instruction as trajectories } from "./trajectories"
import { instruction as conclusion } from "./conclusion"

export const sectionInstructions = { outcomes, "turning-points": turningPoints, actors, conditions, implications, trajectories, conclusion } as const
