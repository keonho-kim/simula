/**
 * Purpose: Define the information instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/scenario-builder/design.ts.
 * Related: src/backend/core/scenario-builder/design.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Define initial knowledge and communication routes. Uploaded source facts are initially shared with all participants unless the user or source explicitly restricts access. Do not invent restrictions from a participant's role or specialty. Keep private goals, undisclosed messages, and later discoveries private until communicated."
