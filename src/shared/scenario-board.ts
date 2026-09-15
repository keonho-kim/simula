import type { ActorAction, ActorRosterEntry, ActorState, PlannedEvent, ScenarioDigest } from "./simulation"

export type ScenarioBoardUpdate =
  | { kind: "preview"; id: string; field: string; content: string; streamId: string; sequence: number }
  | { kind: "actor.started"; id: string }
  | { kind: "config"; actorCount: number; actionCount: number }
  | { kind: "digest"; key: keyof ScenarioDigest; content: string }
  | { kind: "events"; events: PlannedEvent[] }
  | { kind: "actions"; actions: ActorAction[] }
  | { kind: "roster"; actors: ActorRosterEntry[] }
  | { kind: "actor"; id: string; card: Pick<ActorState, "name" | "role" | "backgroundHistory" | "personality" | "preference"> }
