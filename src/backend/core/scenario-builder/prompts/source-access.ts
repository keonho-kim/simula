/**
 * Purpose: Ask for initial actor access to exact source claims without rewriting their evidence.
 * Pattern: Pure prompt definition.
 * Usage: Used by the shared ScenarioBuilder source-access task.
 * Related: src/backend/core/scenario-builder/source-access.ts
 */
export const sourceAccessInstructions = `Choose the initial audience for the ONE SOURCE fact.
Uploaded source facts are initially shared with all participants unless the user, source, or information rule explicitly restricts access.
Return 0 for that shared default; do not list everyone separately.
Return participant numbers separated by commas only for an explicit initial restriction with named recipients.
Return ? only when an explicit restriction exists but its recipients cannot be identified. Do not infer restrictions from a title, goal or interest.
An evidence citation proves the claim's source, not anyone's access. The program copies the source text and references.`
