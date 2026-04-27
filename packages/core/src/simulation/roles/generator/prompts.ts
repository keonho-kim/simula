import type { RoleGraphOptions } from "../shared"

export const generatorPrompts: RoleGraphOptions["prompts"] = {
  thought: (current) =>
    `Generator thought. In one short paragraph, decide what actor cards and actions are needed for this background story.\n\nBackground story: ${current.simulation.plan?.backgroundStory ?? current.scenario.text}`,
  target: (_current, partial) =>
    `Generator target. In one sentence, identify the central actor archetype or action pressure to generate first.\n\nThought: ${partial.thought}`,
  action: (_current, partial) =>
    `Generator action. In one compact sentence, name the actor-card and action set this simulation needs.\n\nTarget: ${partial.target}`,
  intent: (_current, partial) =>
    `Generator intent. In one sentence, explain why these generated actor cards and actions fit the planner background story.\n\nAction: ${partial.action}`,
}
