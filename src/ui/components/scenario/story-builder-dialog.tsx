/**
 * Purpose: Coordinate the scenario drafting dialog, streaming lifecycle, and confirmation flow.
 * Pattern: Page-flow component.
 * Usage: Lazy-loaded by src/ui/app/App.tsx from the landing page.
 * Related: src/ui/components/scenario/story-builder/panels.tsx, src/ui/components/scenario/story-builder/messages.ts
 */
import { useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, CheckIcon, SparklesIcon } from "lucide-react"
import type { PromptLanguage, ScenarioControls, StoryBuilderMessage } from "@/shared"
import { streamDraftScenario } from "@/ui/api/client"
import { Button } from "@/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog"
import type { UiTexts } from "@/ui/types/i18n"
import { StoryBuilderRefine, StoryBuilderSetup } from "./story-builder/panels"
import {
  applyStoryBuilderStreamEvent,
  finishProgressMessage,
  initialProgressMessage,
  type StoryBuilderChatMessage,
} from "./story-builder/messages"
import { clearStoryBuilderSession, writeStoryBuilderSession } from "./story-builder/session"

const DEFAULT_STORY_CONTROLS: ScenarioControls = {
  numCast: 6,
  allowAdditionalCast: true,
  actionsPerType: 3,
  maxRound: 8,
  fastMode: false,
  autonomousProgress: false,
  outputLength: "short",
}

type StoryBuilderStep = "setup" | "refine"

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
  const [previousDraft, setPreviousDraft] = useState("")
  const [messages, setMessages] = useState<StoryBuilderMessage[]>([])
  const [chatMessages, setChatMessages] = useState<StoryBuilderChatMessage[]>([])
  const [controls, setControls] = useState<ScenarioControls>(DEFAULT_STORY_CONTROLS)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasDraft = draft.trim().length > 0

  useEffect(() => {
    if (!open) {
      abortControllerRef.current?.abort()
      abortControllerRef.current = null
      return
    }
    const id = `${Date.now()}`
    const nextControls = { ...DEFAULT_STORY_CONTROLS }
    setSessionId(id)
    setStep("setup")
    setIdea("")
    setChatInput("")
    setDraft("")
    setPreviousDraft("")
    setMessages([])
    setChatMessages([])
    setControls(nextControls)
    setIsGenerating(false)
    setError("")
    clearStoryBuilderSession()
    writeStoryBuilderSession({ id, step: "setup", idea: "", draft: "", messages: [], controls: nextControls })
  }, [open])

  useEffect(() => {
    if (open && sessionId) {
      writeStoryBuilderSession({ id: sessionId, step, idea, draft, messages, controls })
    }
  }, [controls, draft, idea, messages, open, sessionId, step])

  const generateDraft = async (content: string) => {
    if (!content) return
    const nextMessages = [...messages, { role: "user" as const, content }]
    let nextDraft = draft
    let receivedDraft = false
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setMessages(nextMessages)
    setChatMessages((current) => [...current, { role: "user", content }, initialProgressMessage(t)])
    setChatInput("")
    setError("")
    setIsGenerating(true)
    setStep("refine")
    try {
      await streamDraftScenario(
        { messages: nextMessages, controls, language: promptLanguage },
        (event) => {
          if (event.type === "draft") {
            receivedDraft = true
            setPreviousDraft(nextDraft.trim() ? nextDraft : "")
            nextDraft = event.text
            setDraft(event.text)
          } else {
            setChatMessages((current) => applyStoryBuilderStreamEvent(current, event, t))
          }
        },
        abortController.signal
      )
      setMessages([...nextMessages, { role: "assistant", content: nextDraft }])
      setIdea("")
    } catch (cause) {
      if (abortController.signal.aborted) return
      if (receivedDraft) {
        setMessages([...nextMessages, { role: "assistant", content: nextDraft }])
        setIdea("")
      }
      const message = cause instanceof Error ? cause.message : t.storyBuilderFailed
      setError(message)
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

  const confirmDraft = () => {
    if (!hasDraft) return
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
            <StoryBuilderSetup idea={idea} controls={controls} t={t} onControlsChange={setControls} onIdeaChange={setIdea} />
          ) : (
            <StoryBuilderRefine
              chatInput={chatInput}
              chatMessages={chatMessages}
              draft={draft}
              previousDraft={previousDraft}
              isGenerating={isGenerating}
              t={t}
              onChatInputChange={setChatInput}
              onSendRevision={() => void generateDraft(chatInput.trim())}
            />
          )}
          {error ? <p className="pt-3 text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="m-0 border-t bg-muted/30 px-8 py-4 sm:items-center sm:justify-between sm:px-10">
          <div>
            {step === "refine" ? (
              <Button variant="outline" disabled={isGenerating} onClick={() => setStep("setup")}>
                <ArrowLeftIcon data-icon="inline-start" />
                {t.backToBuilderSetup}
              </Button>
            ) : null}
          </div>
          {step === "setup" ? (
            <Button disabled={!idea.trim() || isGenerating} onClick={() => void generateDraft(idea.trim())}>
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
