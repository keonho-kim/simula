import { Annotation, END, START, StateGraph } from "@langchain/langgraph"
import type {
  LLMSettings,
  StoryBuilderDraftRequest,
  StoryBuilderDraftResponse,
  StoryBuilderMessage,
  StoryBuilderStreamEvent,
} from "@simula/shared"
import { invokeRoleText, invokeRoleTextStreaming } from "../llm"
import { withRolePromptGuide } from "../language"
import { renderOutputLengthGuide } from "../prompt"
import { validateRoleSettings } from "../settings"

interface StoryBuilderGraphState {
  request: StoryBuilderDraftRequest
  settings: LLMSettings
  draft: string
  summary: string
  emit: (event: StoryBuilderStreamEvent) => Promise<void>
  options: StoryBuilderRunOptions
}

export interface StoryBuilderRunOptions {
  summarizeChanges?: boolean
  invokeText?: (prompt: string) => Promise<string>
  streamText?: (
    prompt: string,
    onDelta: (content: string) => Promise<void>
  ) => Promise<string>
}

const StoryBuilderAnnotation = Annotation.Root({
  request: Annotation<StoryBuilderDraftRequest>(),
  settings: Annotation<LLMSettings>(),
  draft: Annotation<string>(),
  summary: Annotation<string>(),
  emit: Annotation<(event: StoryBuilderStreamEvent) => Promise<void>>(),
  options: Annotation<StoryBuilderRunOptions>(),
})

export async function draftScenario(
  request: StoryBuilderDraftRequest,
  settings: LLMSettings,
  options: StoryBuilderRunOptions = {}
): Promise<StoryBuilderDraftResponse> {
  validateRoleSettings(settings, "storyBuilder")
  const result = await createStoryBuilderGraph().invoke(initialStoryBuilderState(request, settings, options))
  return { text: result.draft }
}

export async function* streamDraftScenario(
  request: StoryBuilderDraftRequest,
  settings: LLMSettings,
  options: StoryBuilderRunOptions = {}
): AsyncGenerator<StoryBuilderStreamEvent> {
  const queue = createAsyncQueue<StoryBuilderStreamEvent>()
  const run = runStoryBuilderEventStream(request, settings, { ...options, summarizeChanges: true }, queue)

  for await (const event of queue) {
    yield event
  }

  await run
}

export function renderStoryBuilderPrompt(request: StoryBuilderDraftRequest): string {
  return `StoryBuilder for Simula.
Draft or revise one simulation scenario in the same structure as Simula sample scenario files.
${renderOutputLengthGuide(request.controls, "scenario draft")}
The draft must be concrete, actor-driven, and ready to pass into the simulation preview.

Required markdown structure:
- One scenario title.
- "## Purpose and End Condition"
- "## Core Situation"
- "## Key Actors"
- "## Channels"
- "## Immediate Action Units"
- "## Behavioral Realism Rules"

Content requirements:
- Key Actors must include concrete named or role-specific actors with pressure, authority, incentives, and likely behavior.
- Channels must define public, private, and group communication surfaces.
- Immediate Action Units must list practical actions actors can take during rounds.
- Behavioral Realism Rules must prevent magical knowledge, instant consensus, and purely dramatic one-step solutions.
- Do not include YAML frontmatter. The app keeps controls separately.
- Do not use code fences.

Cast: ${request.controls.numCast}
Max rounds: ${request.controls.maxRound ?? 8}
Additional cast: ${request.controls.allowAdditionalCast ? "yes" : "no"}
Actions per visibility: ${request.controls.actionsPerType}

Conversation:
${renderConversation(request.messages)}

Return only the draft. No code fences.`
}

export function renderStoryBuilderChangeSummaryPrompt(
  request: StoryBuilderDraftRequest,
  revisedDraft: string
): string {
  const previousDraft = latestAssistantDraft(request.messages)
  const latestRequest = latestUserRequest(request.messages)
  return `StoryBuilder change summary for Simula.
Explain what changed in the revised scenario draft.
Be concise and concrete. Mention only changes that are reflected in the revised draft.
Use a natural chat response, not a full scenario.

Latest user request:
${latestRequest}

Previous draft:
${previousDraft}

Revised draft:
${revisedDraft}

Return 2-4 short bullets or short sentences. Do not repeat the full draft.`
}

function renderConversation(messages: StoryBuilderMessage[]): string {
  return messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n")
}

export function storyBuilderFallbackDraft(messages: StoryBuilderMessage[]): string {
  const userInput =
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content.trim())
      .filter(Boolean)
      .at(-1) ?? "A group faces a high-pressure decision with incomplete information."

  return [
    "# Scenario Draft",
    "",
    "## Purpose and End Condition",
    "- Start when the central pressure becomes visible to every key actor.",
    "- End when one practical course of action is chosen and the actors understand who carries the cost, authority, and public explanation.",
    "- The goal is to observe how incentives, responsibility, timing, and incomplete information shape the decision.",
    "",
    "## Core Situation",
    `- ${userInput}`,
    "- The situation is already under time pressure, but the decisive facts are incomplete or contested.",
    "- Each actor has a plausible reason to delay, redirect responsibility, or push for a narrower decision.",
    "",
    "## Key Actors",
    "- Primary decision maker: owns the final call and must balance speed, legitimacy, and visible accountability.",
    "- Operational lead: understands execution constraints and pushes for a practical path that can actually be carried out.",
    "- Risk controller: watches legal, financial, or safety exposure and slows the decision until responsibility is explicit.",
    "- Field or channel representative: carries outside pressure back into the room and fears being blamed for delay.",
    "- External stakeholder: reacts to ambiguity, delay, or visible failure and can change the public cost of the decision.",
    "",
    "## Channels",
    "- `public`: official statements, meeting minutes, announcements, press or stakeholder-facing updates",
    "- `private`: direct pressure, risk warnings, informal alignment, responsibility negotiation",
    "- `group`: working meetings, review sessions, cross-functional coordination, fact-check discussions",
    "",
    "## Immediate Action Units",
    "- Reframe the decision around a narrower condition or deadline.",
    "- Ask for missing evidence, revised numbers, or a risk memo before agreeing.",
    "- Push a conditional approval that moves responsibility to another actor.",
    "- Change public wording so the same decision carries less visible risk.",
    "- Escalate the issue to a higher authority when the current group cannot absorb the downside.",
    "",
    "## Behavioral Realism Rules",
    "- Actors should negotiate responsibility, timing, evidence, and public messaging through concrete moves.",
    "- No actor should know every fact at once or solve the conflict through a single perfect statement.",
    "- Progress should come from conditional decisions, tradeoffs, and responsibility allocation rather than long backstory.",
  ].join("\n")
}

function createStoryBuilderGraph() {
  return new StateGraph(StoryBuilderAnnotation)
    .addNode("draftNode", createDraftNode)
    .addNode("changeSummaryNode", createChangeSummaryNode)
    .addEdge(START, "draftNode")
    .addEdge("draftNode", "changeSummaryNode")
    .addEdge("changeSummaryNode", END)
    .compile()
}

async function createDraftNode(state: StoryBuilderGraphState): Promise<Partial<StoryBuilderGraphState>> {
  await state.emit({
    type: "progress",
    stage: "draft",
    status: "started",
    message: "Drafting the revised scenario.",
  })
  const prompt = withRolePromptGuide(renderStoryBuilderPrompt(state.request), {
    language: state.request.language,
    settings: state.settings,
    role: "storyBuilder",
  })
  const generated = await invokeStoryBuilderText(state, prompt)
  const draft = generated || storyBuilderFallbackDraft(state.request.messages)
  await state.emit({ type: "draft", text: draft })
  await state.emit({
    type: "progress",
    stage: "draft",
    status: "completed",
    message: "The revised scenario draft is ready.",
  })
  return { draft }
}

async function createChangeSummaryNode(state: StoryBuilderGraphState): Promise<Partial<StoryBuilderGraphState>> {
  if (!state.options.summarizeChanges || !latestAssistantDraft(state.request.messages)) {
    return { summary: "" }
  }

  await state.emit({
    type: "progress",
    stage: "summary",
    status: "started",
    message: "Summarizing the changes reflected in the draft.",
  })
  const prompt = withRolePromptGuide(renderStoryBuilderChangeSummaryPrompt(state.request, state.draft), {
    language: state.request.language,
    settings: state.settings,
    role: "storyBuilder",
  })
  const summary = await streamStoryBuilderText(state, prompt, async (content) => {
    await state.emit({ type: "summary_delta", content })
  })
  const completedSummary = summary || storyBuilderFallbackSummary(state.request)
  await state.emit({ type: "summary", content: completedSummary })
  await state.emit({
    type: "progress",
    stage: "summary",
    status: "completed",
    message: "The change summary is ready.",
  })
  return { summary: completedSummary }
}

function initialStoryBuilderState(
  request: StoryBuilderDraftRequest,
  settings: LLMSettings,
  options: StoryBuilderRunOptions,
  emit: (event: StoryBuilderStreamEvent) => Promise<void> = async () => {}
): StoryBuilderGraphState {
  return {
    request,
    settings,
    draft: "",
    summary: "",
    emit,
    options,
  }
}

async function invokeStoryBuilderText(state: StoryBuilderGraphState, prompt: string): Promise<string> {
  return state.options.invokeText
    ? state.options.invokeText(prompt)
    : invokeRoleText(state.settings, "storyBuilder", prompt)
}

async function streamStoryBuilderText(
  state: StoryBuilderGraphState,
  prompt: string,
  onDelta: (content: string) => Promise<void>
): Promise<string> {
  if (state.options.streamText) {
    return state.options.streamText(prompt, onDelta)
  }
  const result = await invokeRoleTextStreaming(
    state.settings,
    "storyBuilder",
    "draft",
    1,
    prompt,
    onDelta
  )
  return result.text
}

async function runStoryBuilderEventStream(
  request: StoryBuilderDraftRequest,
  settings: LLMSettings,
  options: StoryBuilderRunOptions,
  queue: AsyncQueue<StoryBuilderStreamEvent>
): Promise<void> {
  try {
    validateRoleSettings(settings, "storyBuilder")
    const stream = createStoryBuilderGraph().streamEvents(
      initialStoryBuilderState(request, settings, options, async (event) => queue.push(event)),
      { version: "v2" }
    )
    for await (const event of stream) {
      void event
      // Node-level events are emitted through the state callback. Consuming the
      // LangGraph stream drives the workflow and keeps the execution observable.
    }
  } catch (error) {
    queue.push({ type: "error", error: error instanceof Error ? error.message : "StoryBuilder failed." })
  } finally {
    queue.close()
  }
}

function latestAssistantDraft(messages: StoryBuilderMessage[]): string {
  return messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .at(-1) ?? ""
}

function latestUserRequest(messages: StoryBuilderMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .at(-1) ?? ""
}

function storyBuilderFallbackSummary(request: StoryBuilderDraftRequest): string {
  const latestRequest = latestUserRequest(request.messages)
  return latestRequest
    ? `Reflected the latest request: ${latestRequest}`
    : "Updated the scenario draft."
}

interface AsyncQueue<T> extends AsyncIterable<T> {
  push(value: T): void
  close(): void
}

function createAsyncQueue<T>(): AsyncQueue<T> {
  const values: T[] = []
  const waiting: Array<(result: IteratorResult<T>) => void> = []
  let closed = false

  return {
    push(value: T) {
      const resolve = waiting.shift()
      if (resolve) {
        resolve({ value, done: false })
        return
      }
      values.push(value)
    },
    close() {
      closed = true
      for (const resolve of waiting.splice(0)) {
        resolve({ value: undefined, done: true })
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<T>> {
          if (values.length > 0) {
            const value = values.shift() as T
            return Promise.resolve({ value, done: false })
          }
          if (closed) {
            return Promise.resolve({ value: undefined, done: true })
          }
          return new Promise((resolve) => waiting.push(resolve))
        },
      }
    },
  }
}
