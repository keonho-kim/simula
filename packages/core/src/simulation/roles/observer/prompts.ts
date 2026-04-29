import type { RoleGraphOptions } from "../shared"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "../../../prompt"

export const observerPrompts: RoleGraphOptions["prompts"] = {
  thought: (current) => {
    const roundIndex = current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length
    const digest = current.simulation.roundDigests.find((item) => item.roundIndex === roundIndex)
    const interactions = current.simulation.interactions
      .filter((item) => item.roundIndex === roundIndex)
      .map((item) => item.content)
      .slice(-8)
    return `Observer thought. Return one short paragraph interpreting round ${roundIndex}.
${renderOutputLengthGuide(current.scenario.controls, "observer thought")}

Pre-round: ${compactText(digest?.preRound.content ?? "No pre-round digest.", scalePromptLimit(350, current.scenario.controls))}
Interactions:
${interactions.length ? compactLines(interactions.map((item) => `- ${item}`), 8, scalePromptLimit(900, current.scenario.controls)) : "No interactions."}`
  },
  target: (current, partial) =>
    `Observer target. Return one sentence naming the key actor, event, or conflict after round ${current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length}.
${renderOutputLengthGuide(current.scenario.controls, "observer target")}

Thought: ${compactText(partial.thought, scalePromptLimit(350, current.scenario.controls))}`,
  action: (current, partial) =>
    `Observer action. Return one compact paragraph summarizing round ${current.simulation.observerRoundIndex ?? current.simulation.roundDigests.length}.
${renderOutputLengthGuide(current.scenario.controls, "observer summary")}

Target: ${compactText(partial.target, scalePromptLimit(250, current.scenario.controls))}`,
  intent: (current, partial) =>
    `Observer intent. Return one sentence on what this round means for later analysis.
${renderOutputLengthGuide(current.scenario.controls, "observer intent")}

Summary: ${compactText(partial.action, scalePromptLimit(350, current.scenario.controls))}`,
}
