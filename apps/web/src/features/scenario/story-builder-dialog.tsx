import { useEffect, useRef, useState } from "react"
import {
  ArrowLeftIcon,
  CheckIcon,
  LoaderCircleIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react"
import type {
  PromptLanguage,
  PromptOutputLength,
  ScenarioControls,
  StoryBuilderMessage,
  StoryBuilderStreamEvent,
} from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { streamDraftScenario } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { MarkdownDiffContent } from "@/shared/ui/markdown-diff-content"

const STORY_BUILDER_SESSION_KEY = "simula.story-builder.session"

const defaultControls: ScenarioControls = {
  numCast: 6,
  allowAdditionalCast: true,
  actionsPerType: 3,
  maxRound: 8,
  fastMode: false,
  outputLength: "short",
}

type StoryBuilderStep = "setup" | "refine"
type StoryBuilderChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; kind: "summary" }
  | { role: "progress"; content: string; pending: boolean }

interface StoryBuilderDialogProps {
  open: boolean
  t: UiTexts
  promptLanguage: PromptLanguage
  onOpenChange: (open: boolean) => void
  onUseDraft: (text: string, controls: ScenarioControls) => void
}

export function StoryBuilderDialog({
  open,
  t,
  promptLanguage,
  onOpenChange,
  onUseDraft,
}: StoryBuilderDialogProps) {
  const [sessionId, setSessionId] = useState("")
  const [step, setStep] = useState<StoryBuilderStep>("setup")
  const [idea, setIdea] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [draft, setDraft] = useState("")
  const [previousDraftForDiff, setPreviousDraftForDiff] = useState("")
  const [messages, setMessages] = useState<StoryBuilderMessage[]>([])
  const [chatMessages, setChatMessages] = useState<StoryBuilderChatMessage[]>([])
  const [controls, setControls] = useState<ScenarioControls>(defaultControls)
  const [isGenerating, setIsGenerating] = useState(false)
  const [storyBuilderError, setStoryBuilderError] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasDraft = draft.trim().length > 0

  useEffect(() => {
    if (!open) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      return
    }
    const nextSessionId = `${Date.now()}`
    const nextControls = { ...defaultControls }
    setSessionId(nextSessionId)
    setStep("setup")
    setIdea("")
    setChatInput("")
    setDraft("")
    setPreviousDraftForDiff("")
    setMessages([])
    setChatMessages([])
    setControls(nextControls)
    setIsGenerating(false)
    setStoryBuilderError("")
    clearStoryBuilderSession()
    writeStoryBuilderSession({
      id: nextSessionId,
      step: "setup",
      idea: "",
      draft: "",
      messages: [],
      controls: nextControls,
    })
  }, [open])

  useEffect(() => {
    if (!open || !sessionId) {
      return
    }
    writeStoryBuilderSession({
      id: sessionId,
      step,
      idea,
      draft,
      messages,
      controls,
    })
  }, [controls, draft, idea, messages, open, sessionId, step])

  const generateDraft = async (content: string) => {
    if (!content) {
      return
    }
    const nextMessages = [
      ...messages,
      { role: "user" as const, content },
    ]
    let nextDraft = draft
    let receivedDraft = false
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setMessages(nextMessages)
    setChatMessages((current) => [
      ...current,
      { role: "user", content },
      {
        role: "progress",
        content: storyBuilderProgressText(
          { type: "progress", stage: "draft", status: "started", message: "" },
          t
        ),
        pending: true,
      },
    ])
    setChatInput("")
    setStoryBuilderError("")
    setIsGenerating(true)
    setStep("refine")
    try {
      await streamDraftScenario(
        { messages: nextMessages, controls, language: promptLanguage },
        (event) => {
          if (event.type === "draft") {
            receivedDraft = true
            setPreviousDraftForDiff(nextDraft.trim() ? nextDraft : "")
            nextDraft = event.text
            setDraft(event.text)
            return
          }
          applyStoryBuilderStreamEvent(event, t, setChatMessages)
        },
        abortController.signal
      )
      setMessages([...nextMessages, { role: "assistant", content: nextDraft }])
      setIdea("")
    } catch (error) {
      if (abortController.signal.aborted) {
        return
      }
      if (receivedDraft) {
        setMessages([...nextMessages, { role: "assistant", content: nextDraft }])
        setIdea("")
      }
      const message = error instanceof Error ? error.message : t.storyBuilderFailed
      setStoryBuilderError(message)
      setChatMessages((current) => [
        ...finishProgressMessage(current, t),
        { role: "assistant", content: message, kind: "summary" },
      ])
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
        setIsGenerating(false)
      }
    }
  }

  const generateInitialDraft = () => {
    generateDraft(idea.trim())
  }

  const sendRevision = () => {
    generateDraft(chatInput.trim())
  }

  const confirmDraft = () => {
    if (!hasDraft) {
      return
    }
    onUseDraft(draft, controls)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[92svh] max-h-[820px] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-[calc(100%-2rem)] xl:max-w-[1180px]">
        <DialogHeader className="px-8 pt-6 sm:px-10">
          <DialogTitle>{t.storyBuilder}</DialogTitle>
          <DialogDescription>{t.storyBuilderDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] px-8 pb-4 sm:px-10">
          {step === "setup" ? (
            <StoryBuilderSetup
              idea={idea}
              controls={controls}
              t={t}
              onControlsChange={setControls}
              onIdeaChange={setIdea}
            />
          ) : (
            <StoryBuilderRefine
              chatInput={chatInput}
              chatMessages={chatMessages}
              draft={draft}
              previousDraft={previousDraftForDiff}
              isGenerating={isGenerating}
              t={t}
              onChatInputChange={setChatInput}
              onSendRevision={sendRevision}
            />
          )}
          {storyBuilderError ? (
            <p className="pt-3 text-sm text-destructive">
              {storyBuilderError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="m-0 border-t bg-muted/30 px-8 py-4 sm:items-center sm:justify-between sm:px-10">
          <div>
            {step === "refine" ? (
              <Button
                variant="outline"
                disabled={isGenerating}
                onClick={() => setStep("setup")}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                {t.backToBuilderSetup}
              </Button>
            ) : null}
          </div>
          {step === "setup" ? (
            <Button
              disabled={!idea.trim() || isGenerating}
              onClick={generateInitialDraft}
            >
              <SparklesIcon data-icon="inline-start" />
              {t.generateDraft}
            </Button>
          ) : (
            <Button disabled={!hasDraft || isGenerating} onClick={confirmDraft}>
              <CheckIcon data-icon="inline-start" />
              {t.confirmDraft}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StoryBuilderSetup({
  idea,
  controls,
  t,
  onControlsChange,
  onIdeaChange,
}: {
  idea: string
  controls: ScenarioControls
  t: UiTexts
  onControlsChange: (controls: ScenarioControls) => void
  onIdeaChange: (idea: string) => void
}) {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="px-1 py-1 pb-6">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="story-builder-input">{t.builderInput}</FieldLabel>
            <Textarea
              id="story-builder-input"
              className="min-h-[220px] resize-none"
              value={idea}
              placeholder={t.builderPlaceholder}
              onChange={(event) => onIdeaChange(event.target.value)}
            />
          </Field>
          <StoryBuilderControls
            controls={controls}
            t={t}
            onControlsChange={onControlsChange}
          />
        </FieldGroup>
      </div>
    </ScrollArea>
  )
}

function StoryBuilderRefine({
  chatInput,
  chatMessages,
  draft,
  previousDraft,
  isGenerating,
  t,
  onChatInputChange,
  onSendRevision,
}: {
  chatInput: string
  chatMessages: StoryBuilderChatMessage[]
  draft: string
  previousDraft: string
  isGenerating: boolean
  t: UiTexts
  onChatInputChange: (value: string) => void
  onSendRevision: () => void
}) {
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" })
  }, [chatMessages])

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="flex min-h-0 flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.generatedDraft}</h3>
        <ScrollArea className="min-h-[320px] rounded-md bg-background/70 p-4 ring-1 ring-border/60 lg:h-full">
          {isGenerating && !draft.trim() ? (
            <div
              role="status"
              className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
            >
              <LoaderCircleIcon className="size-5 animate-spin" />
              <span>{t.storyBuilderGenerating}</span>
            </div>
          ) : (
            <MarkdownDiffContent
              previous={previousDraft}
              current={draft}
              fallback={t.noDraftYet}
            />
          )}
        </ScrollArea>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.builderChatHistory}</h3>
        <ScrollArea className="min-h-[220px] rounded-md bg-background/70 p-3 ring-1 ring-border/60 lg:flex-1">
          <div className="flex flex-col gap-3 pr-1">
            {chatMessages.map((message, index) => (
              <StoryBuilderChatBubble
                key={`${message.role}-${index}`}
                message={message}
                t={t}
              />
            ))}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>
        <Field>
          <FieldLabel htmlFor="story-builder-chat-input">{t.builderChatInput}</FieldLabel>
          <Textarea
            id="story-builder-chat-input"
            className="min-h-[120px] resize-none"
            value={chatInput}
            placeholder={t.builderChatPlaceholder}
            onChange={(event) => onChatInputChange(event.target.value)}
          />
        </Field>
        <Button
          className="w-full sm:w-auto"
          disabled={!chatInput.trim() || isGenerating}
          onClick={onSendRevision}
        >
          <SendIcon data-icon="inline-start" />
          {t.reviseDraft}
        </Button>
      </div>
    </div>
  )
}

function StoryBuilderChatBubble({
  message,
  t,
}: {
  message: StoryBuilderChatMessage
  t: UiTexts
}) {
  const isUser = message.role === "user"
  const label =
    message.role === "user"
      ? t.builderUserMessage
      : message.role === "progress"
        ? t.builderProgressMessage
        : t.builderAssistantMessage

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-md p-3 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted/40"
        }`}
      >
        <div
          className={`text-xs font-medium ${
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {label}
        </div>
        {message.role === "progress" ? (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
            {message.pending ? (
              <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
            ) : null}
            {message.content}
          </p>
        ) : (
          <MarkdownContent
            compact
            content={message.content}
            fallback=""
            className={`mt-1 ${isUser ? "[&_*]:text-primary-foreground" : ""}`}
          />
        )}
      </div>
    </div>
  )
}

function StoryBuilderControls({
  controls,
  t,
  onControlsChange,
}: {
  controls: ScenarioControls
  t: UiTexts
  onControlsChange: (controls: ScenarioControls) => void
}) {
  return (
    <FieldGroup className="gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="builder-cast-size">{t.castSize}</FieldLabel>
          <Input
            id="builder-cast-size"
            type="number"
            min={1}
            value={controls.numCast}
            onChange={(event) =>
              onControlsChange({ ...controls, numCast: Number(event.target.value) })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="builder-max-round">{t.maxRound}</FieldLabel>
          <Input
            id="builder-max-round"
            type="number"
            min={1}
            value={controls.maxRound}
            onChange={(event) =>
              onControlsChange({ ...controls, maxRound: Number(event.target.value) })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="builder-actions-per-type">
            {t.actionsPerType}
          </FieldLabel>
          <Input
            id="builder-actions-per-type"
            type="number"
            min={1}
            value={controls.actionsPerType}
            onChange={(event) =>
              onControlsChange({ ...controls, actionsPerType: Number(event.target.value) })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="builder-output-length">
            {t.outputLength}
          </FieldLabel>
          <Select
            value={controls.outputLength ?? "short"}
            onValueChange={(outputLength) =>
              onControlsChange({ ...controls, outputLength: outputLength as PromptOutputLength })
            }
          >
            <SelectTrigger id="builder-output-length" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">{t.outputLengthShort}</SelectItem>
              <SelectItem value="medium">{t.outputLengthMedium}</SelectItem>
              <SelectItem value="long">{t.outputLengthLong}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <FieldGroup className="gap-3 sm:grid sm:grid-cols-2">
        <Field
          orientation="horizontal"
          className="items-start rounded-md bg-muted/40 p-3"
        >
          <Switch
            id="builder-extra-cast"
            checked={controls.allowAdditionalCast}
            onCheckedChange={(allowAdditionalCast) =>
              onControlsChange({ ...controls, allowAdditionalCast })
            }
          />
          <FieldContent>
            <FieldLabel htmlFor="builder-extra-cast">
              {t.allowExtraCast}
            </FieldLabel>
            <FieldDescription>
              {t.allowExtraCastHelp}
            </FieldDescription>
          </FieldContent>
        </Field>
        <Field
          orientation="horizontal"
          className="items-start rounded-md bg-muted/40 p-3"
        >
          <Switch
            id="builder-fast-mode"
            checked={controls.fastMode}
            onCheckedChange={(fastMode) =>
              onControlsChange({ ...controls, fastMode })
            }
          />
          <FieldContent>
            <FieldLabel htmlFor="builder-fast-mode">
              {t.fastMode}
            </FieldLabel>
            <FieldDescription>{t.fastModeHelp}</FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldGroup>
  )
}

function applyStoryBuilderStreamEvent(
  event: StoryBuilderStreamEvent,
  t: UiTexts,
  setChatMessages: (updater: (current: StoryBuilderChatMessage[]) => StoryBuilderChatMessage[]) => void
) {
  if (event.type === "progress") {
    setChatMessages((current) => updateProgressMessage(current, storyBuilderProgressText(event, t), event.status === "started"))
    return
  }
  if (event.type === "summary_delta") {
    setChatMessages((current) => appendSummaryDelta(current, event.content))
    return
  }
  if (event.type === "summary") {
    setChatMessages((current) => completeSummaryMessage(current, event.content))
  }
}

function storyBuilderProgressText(
  event: Extract<StoryBuilderStreamEvent, { type: "progress" }>,
  t: UiTexts
): string {
  if (event.stage === "summary") {
    return event.status === "started" ? t.storyBuilderSummarizing : t.storyBuilderSummaryReady
  }
  return event.status === "started" ? t.storyBuilderGenerating : t.storyBuilderDraftReady
}

function updateProgressMessage(
  messages: StoryBuilderChatMessage[],
  content: string,
  pending: boolean
): StoryBuilderChatMessage[] {
  const next = [...messages]
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index]?.role === "progress") {
      next[index] = { role: "progress", content, pending }
      return next
    }
  }
  return [...messages, { role: "progress", content, pending }]
}

function finishProgressMessage(messages: StoryBuilderChatMessage[], t: UiTexts): StoryBuilderChatMessage[] {
  return updateProgressMessage(messages, t.storyBuilderDraftReady, false)
}

function appendSummaryDelta(
  messages: StoryBuilderChatMessage[],
  content: string
): StoryBuilderChatMessage[] {
  const last = messages.at(-1)
  if (last?.role === "assistant" && last.kind === "summary") {
    return [
      ...messages.slice(0, -1),
      { role: "assistant", content: `${last.content}${content}`, kind: "summary" },
    ]
  }
  return [...messages, { role: "assistant", content, kind: "summary" }]
}

function completeSummaryMessage(
  messages: StoryBuilderChatMessage[],
  content: string
): StoryBuilderChatMessage[] {
  const last = messages.at(-1)
  if (last?.role === "assistant" && last.kind === "summary") {
    return [
      ...messages.slice(0, -1),
      { role: "assistant", content, kind: "summary" },
    ]
  }
  return [...messages, { role: "assistant", content, kind: "summary" }]
}

function writeStoryBuilderSession(session: {
  id: string
  step: StoryBuilderStep
  idea: string
  draft: string
  messages: StoryBuilderMessage[]
  controls: ScenarioControls
}) {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.setItem(
    STORY_BUILDER_SESSION_KEY,
    JSON.stringify({ ...session, updatedAt: new Date().toISOString() })
  )
}

function clearStoryBuilderSession() {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.removeItem(STORY_BUILDER_SESSION_KEY)
}
