/**
 * Purpose: Define the shared automatic round countdown policy.
 * Pattern: Immutable domain constants.
 * Usage: Imported by browser and server round progression owners.
 * Related: src/ui/hooks/use-round-progression.ts, src/backend/runtime/multiverse/rounds.ts
 */
export const AUTOMATIC_ROUND_DELAY_MS = 5_000
export const AUTOMATIC_ROUND_DELAY_COUNT = 2
