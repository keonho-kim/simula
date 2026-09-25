/**
 * Purpose: Verify actor target, action, visibility, and visible-text prompt contracts.
 * Pattern: Domain contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/simulation/roles/actor/prompts/index.ts, src/backend/core/simulation/roles/actor/state.ts
 */
import { describe, expect, test } from "bun:test"
import { plannerDigestSummary } from "@/backend/core/simulation/planning/digest"
import { actorPrompts } from "@/backend/core/simulation/roles/actor/prompts"
import { buildActorDecision, isValidActorAction, isValidActorTarget } from "@/backend/core/simulation/roles/actor/state"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { actorMemorySentenceLimit, renderActorMemoryLengthGuide } from "@/backend/core/simulation/actors/memory"
import { actorCardPrompts } from "@/backend/core/simulation/roles/generator/cards/prompts"
import { initialActorCardState } from "@/backend/core/simulation/roles/generator/cards/state"
import { parseActorRoster } from "@/backend/core/simulation/roles/generator/roster"
import { buildRepairChoicePrompt } from "@/backend/core/simulation/roles/repair/prompts/exact-choice"
import { buildActorChoiceState, buildDigestSimulation } from "./scenario-fixtures"

describe("actor contracts", () => {
test("rejects duplicate actor roster names", () => {
    expect(() => parseActorRoster("1. Dana - Channel lead\n2. Dana - Consumer advocate", 2)).toThrow(
      "duplicate actor name"
    )
  })

  test("requires exact actor and action ids for actor choices", () => {
    const state = buildActorChoiceState()
    const actionState = {
      ...state,
      trace: { ...state.trace, action: "actor-1-public-1" },
    }
    const noActionState = {
      ...state,
      trace: { ...state.trace, action: "no_action" },
    }

    const targetPrompt = actorPrompts.target(state, { thought: "Pressure is visible.", action: "actor-1-public-1" })
    const allowedTargetOutputs = targetPrompt.split("Allowed outputs:\n")[1]?.split("\nTarget context:")[0]?.trim()

    expect(allowedTargetOutputs).toBe("- actor-2")
    expect(targetPrompt).toContain("Target context:\nactor-2: Actor 2")
    expect(allowedTargetOutputs).not.toContain("Target history.")
    expect(actorPrompts.target({ ...state, scenario: { ...state.scenario, controls: { ...state.scenario.controls, outputLength: "long" } } }, { thought: "Pressure is visible.", action: "actor-1-public-1" })).not.toContain("detailed")
    expect(actorPrompts.action(state, { thought: "Pressure is visible." })).toContain("- actor-1-public-1")
    expect(isValidActorTarget("actor-2", actionState)).toBe(true)
    expect(isValidActorTarget("None", actionState)).toBe(false)
    expect(isValidActorTarget("None", noActionState)).toBe(true)
    expect(isValidActorTarget("Actor 2", actionState)).toBe(false)
    expect(isValidActorTarget("actor-2.", actionState)).toBe(false)
    expect(isValidActorTarget("none", noActionState)).toBe(false)
    expect(isValidActorAction("actor-1-public-1", state)).toBe(true)
    expect(isValidActorAction("no_action", state)).toBe(true)
    expect(isValidActorAction("Public move 1", state)).toBe(false)
    expect(isValidActorAction("None", state)).toBe(false)
  })

  test("guides actor choices toward realistic access paths", () => {
    const state = buildActorChoiceState()
    const actionPrompt = actorPrompts.action(state, { thought: "Pressure is visible." })
    const targetPrompt = actorPrompts.target(state, { thought: "Pressure is visible.", action: "actor-1-public-1" })

    expect(actionPrompt).toContain("channels this actor can realistically use")
    expect(actionPrompt).toContain("Do not jump to private or semi-public contact")
    expect(targetPrompt).toContain("realistic access path")
    expect(targetPrompt).toContain("Avoid unrealistic leaps")
    expect(targetPrompt).not.toContain("If direct contact would be awkward")
    expect(targetPrompt).toContain("Return exactly one allowed output from Allowed outputs")
    expect(targetPrompt).toContain("Target context:\nactor-2: Actor 2")
    expect(targetPrompt).toContain("Target history.")
  })

  test("keeps no-action silent and preserves targets for real actions", () => {
    const state = buildActorChoiceState()
    const noAction = buildActorDecision({
      ...state,
      trace: {
        ...state.trace,
        action: "no_action",
        target: "actor-2",
        thought: "Wait until the evidence is clearer.",
        intent: "Hold position.",
        message: "We need to talk.",
      },
    })

    expect(noAction.decisionType).toBe("no_action")
    expect(noAction.targetActorIds).toEqual([])
    expect(noAction.message).toBeUndefined()
    expect(noAction.thought).toBe("Wait until the evidence is clearer.")

    const action = buildActorDecision({
      ...state,
      trace: {
        ...state.trace,
        action: "actor-1-public-1",
        target: "actor-2",
        intent: "Push the issue.",
        message: "We need a concrete answer now.",
      },
    })

    expect(action.decisionType).toBe("action")
    expect(action.targetActorIds).toEqual(["actor-2"])
    expect(action.message).toBe("We need a concrete answer now.")
  })

  test("keeps internal actor and action ids out of actor visible text", () => {
    const state = buildActorChoiceState()
    const prompt = actorPrompts.intent(state, {
      target: "actor-2",
      action: "actor-1-public-1",
    })

    expect(prompt).toContain("Target: actor-2 (Actor 2")
    expect(prompt).toContain("Action: actor-1-public-1 (public, Public move 1)")
    expect(prompt).toContain("use actor names and action labels")

    const decision = buildActorDecision({
      ...state,
      trace: {
        ...state.trace,
        action: "actor-1-public-1",
        target: "actor-2",
        intent: "Confirm actor-2 through actor-1-public-1.",
        message: "I will use actor-1-public-1 with actor-2.",
      },
    })

    expect(decision.targetActorIds).toEqual(["actor-2"])
    expect(decision.actionId).toBe("actor-1-public-1")
    expect(decision.intent).toBe("Confirm Actor 2 through Public move 1.")
    expect(decision.message).toBe("I will use Public move 1 with Actor 2.")
  })

  test("builds repair prompt with raw invalid output and exact allowed values", () => {
    const prompt = buildRepairChoicePrompt({
      sourceRole: "actor",
      sourceStep: "action",
      sourceId: "actor-1",
      invalidText: "I will make a public move.",
      allowedOutputs: ["actor-1-public-1", "no_action"],
    })

    expect(prompt).toContain("<REVIEW_TARGET>\nI will make a public move.\n</REVIEW_TARGET>")
    expect(prompt).toContain("- actor-1-public-1")
    expect(prompt).toContain("- no_action")
    expect(prompt).toContain("Return exactly one allowed output")
  })

  test("compacts long prompt inputs", () => {
    expect(compactText("alpha ".repeat(300), 80).length).toBeLessThanOrEqual(80)
    expect(compactLines(["one", "two", "three", "four"], 2, 40)).toBe("three\nfour")
    expect(compactLines(["alpha ".repeat(50), "beta ".repeat(50)], 2, 90).length).toBeLessThanOrEqual(90)
  })

  test("scales prompt length guide by output length", () => {
    expect(renderOutputLengthGuide({ outputLength: "short" })).toContain("concise")
    expect(renderOutputLengthGuide({ outputLength: "medium" })).toContain("moderate")
    expect(renderOutputLengthGuide({ outputLength: "long" })).toContain("detailed")
    expect(scalePromptLimit(100, { outputLength: "short" })).toBe(100)
    expect(scalePromptLimit(100, { outputLength: "medium" })).toBe(150)
    expect(scalePromptLimit(100, { outputLength: "long" })).toBe(200)
  })

  test("maps actor memory compression length to output length", () => {
    expect(actorMemorySentenceLimit({ outputLength: "short" })).toBe(3)
    expect(actorMemorySentenceLimit({ outputLength: "medium" })).toBe(5)
    expect(actorMemorySentenceLimit({ outputLength: "long" })).toBe(10)
    expect(renderActorMemoryLengthGuide({ outputLength: "medium" })).toBe(
      "Return at most 5 short first-person sentences."
    )
  })

  test("keeps actor card background prompt on planner digest", () => {
    const simulation = buildDigestSimulation()
    const prompt = actorCardPrompts.backgroundHistory(
      ({ ...initialActorCardState(),
        runId: "digest-run",
        language: simulation.scenario.language,
        actorIndex: 1,
        assignedName: "Actor 1",
        roleSeed: "Primary decision maker",
        fullRoster: [
          { index: 1, name: "Actor 1", roleSeed: "Primary decision maker" },
          { index: 2, name: "Actor 2", roleSeed: "External stakeholder" },
        ],
        plannerDigest: plannerDigestSummary(simulation.plan, simulation.scenario.text),
      })
    )

    expect(prompt).not.toContain("Roster:")
    expect(prompt).not.toContain("Actor 2")
    expect(prompt).toContain("Planner scenario digest")
    expect(prompt).toContain("Actor pressures: Stakeholders face cost.")
  })

  test("actor thought uses compact digest instead of the full scenario body", () => {
    const state = buildActorChoiceState()
    const scenarioMarker = "FULL_SCENARIO_BODY_SHOULD_NOT_BE_INCLUDED"
    const input = {
      ...state,
      scenario: {
        ...state.scenario,
        text: `${scenarioMarker} ${"long ".repeat(200)}`,
      },
      plannerDigest: "Compact digest for actor reasoning.",
    }
    const prompt = actorPrompts.thought(input, {})

    expect(prompt).toContain("Compact digest for actor reasoning.")
    expect(prompt).not.toContain(scenarioMarker)
  })
})
