import type { RunEvent, ScenarioBoardUpdate, ScenarioDigest } from "@/shared"

export const DIGEST_KEYS = ["coreSituation", "actorPressures", "conflictDynamics", "simulationDirection"] as const
export interface ScenarioBoardState {
  started: boolean
  ready: boolean
  terminal: boolean
  config?: Extract<ScenarioBoardUpdate, { kind: "config" }>
  digest: Partial<ScenarioDigest>
  events: Extract<ScenarioBoardUpdate, { kind: "events" }>["events"]
  actions: Extract<ScenarioBoardUpdate, { kind: "actions" }>["actions"]
  roster: Extract<ScenarioBoardUpdate, { kind: "roster" }>["actors"]
  cards: Record<string, Extract<ScenarioBoardUpdate, { kind: "actor" }>["card"]>
}
export function emptyScenarioBoard(): ScenarioBoardState {
  return { started: false, ready: false, terminal: false, digest: {}, events: [], actions: [], roster: [], cards: {} }
}

/** Retain accepted artifacts independently of the rolling telemetry window. */
export function updateScenarioBoard(current: ScenarioBoardState, events: RunEvent[]): ScenarioBoardState {
  let board = current
  for (const event of events) {
    if (event.type === "run.started") board = { ...emptyScenarioBoard(), started: true }
    if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
      board = { ...board, terminal: true }
    }
    if (event.type === "event.injected" || event.type === "interaction.recorded") {
      if (!board.ready) board = { ...board, ready: true }
    }
    if (event.type !== "board.updated") continue
    const value = event.update
    switch (value.kind) {
      case "config": board = { ...board, config: value }; break
      case "digest": board = { ...board, digest: { ...board.digest, [value.key]: value.content } }; break
      case "events": board = { ...board, events: value.events }; break
      case "actions": {
        const actions = new Map(board.actions.map(action => [action.id, action]))
        for (const action of value.actions) actions.set(action.id, action)
        board = { ...board, actions: [...actions.values()] }
        break
      }
      case "roster": board = { ...board, roster: value.actors }; break
      case "actor": board = { ...board, cards: { ...board.cards, [value.id]: value.card } }; break
    }
  }
  return board
}

export function boardProgress(board: ScenarioBoardState): number | undefined {
  if (!board.config) return undefined
  // Four digests, one event batch, roster, and the first round handoff are fixed units.
  const total = 7 + board.config.actionCount + board.config.actorCount
  const done = Object.keys(board.digest).length + Number(board.events.length > 0) + board.actions.length +
    Number(board.roster.length > 0) + Object.keys(board.cards).length + Number(board.ready)
  return Math.min(100, Math.floor(done / total * 100))
}
