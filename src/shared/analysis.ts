/**
 * Purpose: Expose the stable public contract for cross-runtime simulation analysis.
 * Pattern: Public module boundary.
 * Usage: Imported through @/shared by backend reports and browser presentation models.
 * Related: src/shared/analysis/types.ts, src/shared/analysis/run.ts
 */
export type * from "./analysis/types"
export { calculateNetworkDynamics } from "./analysis/network"
export { calculateRunAnalysis } from "./analysis/run"
