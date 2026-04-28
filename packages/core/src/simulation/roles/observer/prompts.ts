import type { RoleGraphOptions } from "../shared"

export const observerPrompts: RoleGraphOptions["prompts"] = {
  thought: (current) => {
    const roundIndex = current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length
    const digest = current.simulation.roundDigests.find((item) => item.roundIndex === roundIndex)
    const interactions = current.simulation.interactions
      .filter((item) => item.roundIndex === roundIndex)
      .map((item) => item.content)
      .join(" ")
    return `Observer thought. In one short paragraph, interpret what actually happened in round ${roundIndex}.

Pre-round: ${digest?.preRound.content ?? "No pre-round digest."}
Interactions: ${interactions || "No interactions."}`
  },
  target: (current, partial) =>
    `Observer target. In one sentence, name the key actor, event, or conflict to watch after round ${current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length}.

Thought: ${partial.thought}`,
  action: (current, partial) =>
    `Observer action. In one compact paragraph, write a user-facing summary for round ${current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length}.

Target: ${partial.target}`,
  intent: (current, partial) =>
    `Observer intent. In one sentence, explain what this round means for later analysis.

Round ${current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length} summary: ${partial.action}`,
}
