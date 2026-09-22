/**
 * Purpose: Verify scenario draft prompts, fallback shape, and ordered streaming events.
 * Pattern: Workflow contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/story-builder/index.ts
 */
import { describe, expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import {
  renderStoryBuilderChangeSummaryPrompt,
  renderStoryBuilderPrompt,
  streamDraftScenario,
  storyBuilderFallbackDraft,
} from "@/backend/core/story-builder"

describe("story builder", () => {
test("renders sample-shaped fallback drafts", () => {
    const draft = storyBuilderFallbackDraft([
      { role: "user", content: "A hospital board delays a risky emergency expansion." },
    ])

    expect(draft).toContain("# Scenario Draft")
    expect(draft).toContain("## Purpose and End Condition")
    expect(draft).toContain("## Core Situation")
    expect(draft).toContain("## Key Actors")
    expect(draft).toContain("## Channels")
    expect(draft).toContain("## Immediate Action Units")
    expect(draft).toContain("## Behavioral Realism Rules")
    expect(draft).toContain("A hospital board delays a risky emergency expansion.")
  })

  test("instructs StoryBuilder to revise with conversation context", () => {
    const prompt = renderStoryBuilderPrompt({
      messages: [
        { role: "user", content: "A city council faces a controversial infrastructure vote." },
        { role: "assistant", content: "# Scenario Draft\n\n## Core Situation\n- First draft." },
        { role: "user", content: "Make the finance pressure sharper." },
      ],
      controls: {
        numCast: 5,
        allowAdditionalCast: false,
        actionsPerType: 2,
        maxRound: 6,
        fastMode: false,
        outputLength: "short",
      },
      language: "en",
    })

    expect(prompt).toContain("same structure as Simula sample scenario files")
    expect(prompt).toContain("Do not include YAML frontmatter")
    expect(prompt).toContain("Cast: 5")
    expect(prompt).toContain("Max rounds: 6")
    expect(prompt).toContain("Actions per visibility: 2")
    expect(prompt).toContain("Assistant: # Scenario Draft")
    expect(prompt).toContain("User: Make the finance pressure sharper.")
  })

  test("streams initial drafts without a change summary", async () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const events = []
    for await (const event of streamDraftScenario(
      {
        messages: [{ role: "user", content: "A council debates a flood wall." }],
        controls: {
          numCast: 4,
          allowAdditionalCast: true,
          actionsPerType: 3,
          maxRound: 8,
          fastMode: false,
          outputLength: "short",
        },
      },
      settings,
      {
        invokeText: async () => "# Scenario Draft\n\n## Core Situation\n- Flood wall conflict.",
      }
    )) {
      events.push(event)
    }

    expect(events.some((event) => event.type === "draft")).toBe(true)
    expect(events.some((event) => event.type === "summary")).toBe(false)
    expect(events.filter((event) => event.type === "progress").map((event) => event.stage)).toEqual([
      "draft",
      "draft",
    ])
  })

  test("streams revised drafts before the reflected change summary", async () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const events = []
    for await (const event of streamDraftScenario(
      {
        messages: [
          { role: "user", content: "A council debates a flood wall." },
          { role: "assistant", content: "# Scenario Draft\n\n## Core Situation\n- First draft." },
          { role: "user", content: "Make the finance pressure sharper." },
        ],
        controls: {
          numCast: 4,
          allowAdditionalCast: true,
          actionsPerType: 3,
          maxRound: 8,
          fastMode: false,
          outputLength: "short",
        },
      },
      settings,
      {
        invokeText: async () => "# Scenario Draft\n\n## Core Situation\n- Finance pressure is sharper.",
        streamText: async (_prompt, onDelta) => {
          await onDelta("Sharpened finance ")
          await onDelta("pressure.")
          return "Sharpened finance pressure."
        },
      }
    )) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual([
      "progress",
      "draft",
      "progress",
      "progress",
      "summary_delta",
      "summary_delta",
      "summary",
      "progress",
    ])
    expect(events.find((event) => event.type === "draft")).toEqual({
      type: "draft",
      text: "# Scenario Draft\n\n## Core Situation\n- Finance pressure is sharper.",
    })
    expect(
      events
        .filter((event) => event.type === "summary_delta")
        .map((event) => event.content)
        .join("")
    ).toBe("Sharpened finance pressure.")
  })

  test("renders a prompt for reflected change summaries", () => {
    const prompt = renderStoryBuilderChangeSummaryPrompt(
      {
        messages: [
          { role: "user", content: "A council debates a flood wall." },
          { role: "assistant", content: "# Scenario Draft\n\n## Core Situation\n- First draft." },
          { role: "user", content: "Make the finance pressure sharper." },
        ],
        controls: {
          numCast: 4,
          allowAdditionalCast: true,
          actionsPerType: 3,
          maxRound: 8,
          fastMode: false,
          outputLength: "short",
        },
      },
      "# Scenario Draft\n\n## Core Situation\n- Finance pressure is sharper."
    )

    expect(prompt).toContain("Latest user request:")
    expect(prompt).toContain("Make the finance pressure sharper.")
    expect(prompt).toContain("Previous draft:")
    expect(prompt).toContain("First draft.")
    expect(prompt).toContain("Revised draft:")
    expect(prompt).toContain("Finance pressure is sharper.")
  })
})
