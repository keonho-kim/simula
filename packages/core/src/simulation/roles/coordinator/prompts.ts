import type { RoleGraphOptions } from "../shared"

export const coordinatorPrompts: RoleGraphOptions["prompts"] = {
  thought: (current) =>
    `Coordinator thought. In one short paragraph, explain how runtime interactions should progress.\n\nScenario: ${current.scenario.text}`,
  target: (_current, partial) =>
    `Coordinator target. In one sentence, choose the actor or event pressure to coordinate first.\n\nThought: ${partial.thought}`,
  action: (_current, partial) =>
    `Coordinator action. In one sentence, describe the next runtime coordination action.\n\nTarget: ${partial.target}`,
  intent: (_current, partial) =>
    `Coordinator intent. In one sentence, explain why this action advances the simulation.\n\nAction: ${partial.action}`,
}
