/**
 * Purpose: Expose the cohesive actor graph construction and context boundary.
 * Pattern: Module public contract.
 * Usage: Imported by coordinator actor-round and actor workflow tests.
 * Related: src/backend/core/simulation/roles/actor/graph.ts, src/backend/core/simulation/roles/actor/context.ts
 */
export { createActorGraph } from "./graph"
export { createActorContext } from "./context"
export { createActorGraphState, type ActorGraphState, type ActorStepInput } from "./state"
