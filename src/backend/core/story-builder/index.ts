/**
 * Purpose: Execute Story Builder graph requests and stream ordered workflow events.
 * Pattern: Workflow graph.
 * Usage: Called by Story Builder API routes for draft and streaming responses.
 * Related: src/backend/core/story-builder/prompts/draft.ts, src/backend/core/story-builder/async-queue.ts
 */
import { Annotation, END, START, StateGraph } from "@langchain/langgraph"
import type {
  LLMSettings,
  StoryBuilderDraftRequest,
  StoryBuilderDraftResponse,
  StoryBuilderStreamEvent,
} from "@/shared"
import { invokeRoleText, invokeRoleTextStreaming } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { validateRoleSettings } from "@/backend/core/settings"
import { createAsyncQueue, type AsyncQueue } from "./async-queue"
import { latestAssistantDraft, storyBuilderFallbackDraft, storyBuilderFallbackSummary } from "./conversation"
import { renderStoryBuilderPrompt } from "./prompts/draft"
import { renderStoryBuilderChangeSummaryPrompt } from "./prompts/change-summary"

export { renderStoryBuilderPrompt } from "./prompts/draft"
export { renderStoryBuilderChangeSummaryPrompt } from "./prompts/change-summary"
export { storyBuilderFallbackDraft } from "./conversation"

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
