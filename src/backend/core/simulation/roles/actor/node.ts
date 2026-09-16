import type { ActorTraceStep, RunEvent } from "@/shared"
import { invokeExactChoiceWithMetrics, invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { normalizePromptLanguage, withPromptLanguageGuide, withRolePromptGuide } from "@/backend/core/prompts/language"
import { scalePromptLimit } from "@/backend/core/prompts/prompt"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { repairExactChoice } from "@/backend/core/simulation/roles/repair"
import type { ActorPromptBuilder } from "@/backend/core/simulation/roles/actor/prompts"
import { normalizeActorMessage } from "@/backend/core/simulation/roles/actor/state"
import type { ActorGraphState } from "@/backend/core/simulation/roles/actor/state"

const MAX_ATTEMPTS = 5
const MAX_MESSAGE_ATTEMPTS = 3

export async function runActorTextNode(
  state: ActorGraphState,
  step: ActorTraceStep,
  promptBuilder: ActorPromptBuilder,
  partial: Partial<Record<ActorTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>,
  validate?: (value: string, state: ActorGraphState) => boolean,
  allowedOutputs?: (state: ActorGraphState) => string[]
): Promise<{ text: string; retries: number }> {
  const invalidResponses: string[] = []
  const maxAttempts = step === "message" ? MAX_MESSAGE_ATTEMPTS : MAX_ATTEMPTS
  let messageIssue = ""
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const allowed = allowedOutputs?.(state) ?? []
    const retryGuide =
      validate && invalidResponses.length
        ? `\n\nPrevious invalid responses:\n${invalidResponses.map((item) => `- ${item}`).join("\n")}\nReturn one exact allowed output only:\n${allowed.map((item) => `- ${item}`).join("\n")}`
        : messageIssue ? `\n\n${messageIssue}` : ""
    const basePrompt = promptBuilder(state, partial) + retryGuide
    const prompt =
      validate && allowed.length
        ? withPromptLanguageGuide(basePrompt, state.scenario.language)
        : withRolePromptGuide(basePrompt, {
            language: state.scenario.language,
            settings: state.settings,
            role: "actor",
          })
    const result = validate && allowed.length
      ? await invokeExactChoiceWithMetrics(state.settings, "actor", step, attempt, prompt, allowed)
      : await invokeRoleTextWithMetrics(state.settings, "actor", step, attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit, { actorId: state.actor.id, actorName: state.actor.name })

    const response = validate ? result.text.trim() : normalizePlainText(result.text, state)
    messageIssue = step === "message" ? messageFeedback(response, partial, state) : ""
    if (response && !messageIssue && (!validate || validate(response, state))) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "actor",
        content: `${state.actor.name} ${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    if (validate && allowedOutputs) {
      const repaired = await repairExactChoice({
        runId: state.runId,
        scenario: state.scenario,
        settings: state.settings,
        sourceRole: "actor",
        sourceStep: step,
        sourceId: state.actor.id,
        invalidText: response || "<empty>",
        allowedOutputs: allowed,
        emit,
      })
      if (repaired && validate(repaired, state)) {
        await emit({
          type: "model.message",
          runId: state.runId,
          timestamp: timestamp(),
          role: "actor",
          content: `${state.actor.name} ${step}: ${repaired}`,
        })
        return { text: repaired, retries: attempt - 1 }
      }
    }
    invalidResponses.push(preview(response))

    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `actor.${step} for ${state.actor.id} returned invalid text on attempt ${attempt}/${maxAttempts}: ${messageIssue || preview(response)}`,
    })
  }

  throw new Error(`actor.${step} for ${state.actor.id} failed after ${maxAttempts} invalid responses.${messageIssue ? ` ${messageIssue}` : ""}`)
}

function normalizePlainText(value: string, state: ActorGraphState): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = scalePromptLimit(700, state.scenario.controls)
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact || "<empty>"
}

function timestamp(): string {
  return new Date().toISOString()
}

function messageFeedback(response: string, partial: Partial<Record<ActorTraceStep, string>>, state: ActorGraphState): string {
  const korean = normalizePromptLanguage(state.scenario.language) === "ko"
  if (!response) return korean ? "발화가 비어 있습니다. 실제 대사 하나 또는 침묵을 뜻하는 None을 반환하세요." : "Speech was empty. Return one spoken line or None for silence."
  if (!normalizeActorMessage(response)) return ""
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}]/gu, "")
  const spoken = normalize(response)
  // Compare whole texts only: shared meaning or a shared phrase is not an error.
  const source = (["thought", "intent"] as const).find(key => spoken && spoken === normalize(partial[key] ?? ""))
  if (!source) return ""
  return korean
    ? `직전 발화가 ${source === "thought" ? "생각" : "의도"} 문장을 그대로 복사했습니다: ${preview(response)}\n생각·의도·행동·대상은 유지하고 발화만 다시 작성하세요. 내적 설명 대신 상대에게 실제로 하는 요청·질문·답변으로 표현하세요. 의미를 바꾸거나 숨은 동기를 만들 필요는 없습니다. 실제로 말하지 않는 경우에만 None을 사용하세요.`
    : `The previous speech copied ${source}: ${preview(response)}\nKeep thought, intent, action and target unchanged; rewrite only the spoken line as a request, question or reply to the recipient, not an internal explanation. Keep the meaning; do not invent hidden motives. Use None only if genuinely not speaking.`
}
