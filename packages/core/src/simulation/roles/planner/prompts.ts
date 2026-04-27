import type { RoleGraphOptions } from "../shared"

export const plannerPrompts: RoleGraphOptions["prompts"] = {
  thought: (current) =>
    `Planner thought. In one short paragraph, interpret the initial scenario input and its hidden pressure.\n\nScenario: ${current.scenario.text}`,
  target: (_current, partial) =>
    `Planner target. In one sentence, name the main background force, place, or conflict the story should center on.\n\nThought: ${partial.thought}`,
  action: (_current, partial) =>
    `Planner action. In one compact paragraph, write the background story that sets up the simulation world.\n\nTarget: ${partial.target}`,
  intent: (_current, partial) =>
    `Planner intent. In one sentence, explain why this background story creates useful actor pressure.\n\nBackground story: ${partial.action}`,
}
