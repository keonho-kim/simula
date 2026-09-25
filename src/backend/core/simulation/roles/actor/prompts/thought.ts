/**
 * Purpose: Build the actor thought model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { coordinatorDirective } from "./context"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { ActorPromptBuilder } from "./contracts"

const PRIVATE_CONCERN_CHARS = 500

export const thought: ActorPromptBuilder = (state) =>
    `Actor thought. As the actor below, return one short paragraph using only visible context and private profile.
${textGuide(state.scenario.language)}
${renderOutputLengthGuide(state.scenario.controls, "actor thought")}

${renderPromptBlock("SCENARIO", `Digest: ${compactText(state.plannerDigest, scalePromptLimit(650, state.scenario.controls))}`)}

${renderPromptBlock("SIMULATION", `Round ${state.roundIndex}: ${state.event.title}. ${state.event.summary}
Pre-round: ${compactText(state.roundDigest.preRound.content, scalePromptLimit(300, state.scenario.controls))}`)}

${renderPromptBlock("HISTORY", `Context:
${state.history}`)}

${renderPromptBlock("SOURCE", { initiallyKnownFacts: state.actor.knownSourceFacts ?? [] })}

${renderPromptBlock("ACTOR", `Name: ${state.actor.name}\nProfile: ${state.actor.role}; ${compactText(state.actor.backgroundHistory, scalePromptLimit(220, state.scenario.controls))}; ${compactText(state.actor.personality, scalePromptLimit(160, state.scenario.controls))}; wants ${compactText(state.actor.preference, scalePromptLimit(180, state.scenario.controls))}.\nOwn private concern: ${compactText(state.actor.privateGoal, PRIVATE_CONCERN_CHARS)}`)}

${renderPromptBlock("CONSTRAINTS", `Guidance:
${compactLines([
  `Frame: ${coordinatorDirective(state.coordinatorTrace.runtimeFrame, "runtimeFrame", "Runtime Frame")}`,
  `Routing: ${coordinatorDirective(state.coordinatorTrace.actorRouting, "actorRouting", "Actor Routing")}`,
  `Policy: ${coordinatorDirective(state.coordinatorTrace.interactionPolicy, "interactionPolicy", "Interaction Policy")}`,
  `Outcome: ${coordinatorDirective(state.coordinatorTrace.outcomeDirection, "outcomeDirection", "Outcome Direction")}`,
], 4, scalePromptLimit(700, state.scenario.controls))}`)}`

function textGuide(language: string | undefined): string {
  const korean = normalizePromptLanguage(language) === "ko"
  const instruction = korean ? "현재 인물이 상황을 어떻게 해석하고 무엇을 원하거나 걱정하는지 짧은 내적 독백으로 작성하세요. 상대에게 직접 말하는 대사는 쓰지 마세요. 모르는 사실이나 숨은 동기를 지어내지 마세요." : "Write a short private reflection: how this actor interprets the situation and what they want or worry about. Do not address another actor with spoken dialogue. Do not invent unknown facts or hidden motives."
  return `${instruction}\n${korean
    ? "현재 단계의 내용만 출력하세요. 생각·의도·발화를 함께 쓰거나 제목을 붙이지 마세요."
    : "Output only the current step. Do not include other steps or a heading."}`
}
