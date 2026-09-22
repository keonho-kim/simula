/**
 * Purpose: Render the setup and refinement panels of the story-builder dialog.
 * Pattern: Presentation components.
 * Usage: Composed by src/ui/components/scenario/story-builder-dialog.tsx.
 * Related: src/ui/components/scenario/story-builder/controls.tsx, src/ui/components/scenario/story-builder/messages.ts
 */
import { useEffect, useRef } from "react"
import { LoaderCircleIcon, SendIcon } from "lucide-react"
import type { ScenarioControls } from "@/shared"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { MarkdownDiffContent } from "@/ui/components/markdown/markdown-diff-content"
import { Button } from "@/ui/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/ui/components/ui/field"
import { ScrollArea } from "@/ui/components/ui/scroll-area"
import { Textarea } from "@/ui/components/ui/textarea"
import type { UiTexts } from "@/ui/types/i18n"
import { StoryBuilderControls } from "./controls"
import type { StoryBuilderChatMessage } from "./messages"

interface SetupProps {
  idea: string
  controls: ScenarioControls
  t: UiTexts
  onControlsChange: (controls: ScenarioControls) => void
  onIdeaChange: (idea: string) => void
}

export function StoryBuilderSetup({
  idea,
  controls,
  t,
  onControlsChange,
  onIdeaChange,
}: SetupProps) {
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
          <StoryBuilderControls controls={controls} t={t} onControlsChange={onControlsChange} />
        </FieldGroup>
      </div>
    </ScrollArea>
  )
}

interface RefineProps {
  chatInput: string
  chatMessages: StoryBuilderChatMessage[]
  draft: string
  previousDraft: string
  isGenerating: boolean
  t: UiTexts
  onChatInputChange: (value: string) => void
  onSendRevision: () => void
}

export function StoryBuilderRefine({
  chatInput,
  chatMessages,
  draft,
  previousDraft,
  isGenerating,
  t,
  onChatInputChange,
  onSendRevision,
}: RefineProps) {
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
            <div role="status" className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <LoaderCircleIcon />
              <span>{t.storyBuilderGenerating}</span>
            </div>
          ) : (
            <MarkdownDiffContent previous={previousDraft} current={draft} fallback={t.noDraftYet} />
          )}
        </ScrollArea>
      </div>
      <div className="flex min-h-0 flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.builderChatHistory}</h3>
        <ScrollArea className="min-h-[220px] rounded-md bg-background/70 p-3 ring-1 ring-border/60 lg:flex-1">
          <div className="flex flex-col gap-3 pr-1">
            {chatMessages.map((message, index) => (
              <StoryBuilderChatBubble key={`${message.role}-${index}`} message={message} t={t} />
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
        <Button className="w-full sm:w-auto" disabled={!chatInput.trim() || isGenerating} onClick={onSendRevision}>
          <SendIcon data-icon="inline-start" />
          {t.reviseDraft}
        </Button>
      </div>
    </div>
  )
}

function StoryBuilderChatBubble({ message, t }: { message: StoryBuilderChatMessage; t: UiTexts }) {
  const isUser = message.role === "user"
  const label = message.role === "user"
    ? t.builderUserMessage
    : message.role === "progress"
      ? t.builderProgressMessage
      : t.builderAssistantMessage

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[86%] rounded-md p-3 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted/40"}`}>
        <div className={`text-xs font-medium ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {label}
        </div>
        {message.role === "progress" ? (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
            {message.pending ? <LoaderCircleIcon data-icon="inline-start" /> : null}
            {message.content}
          </p>
        ) : (
          <MarkdownContent
            compact
            content={message.content}
            fallback=""
            className={isUser ? "mt-1 [&_*]:text-primary-foreground" : "mt-1"}
          />
        )}
      </div>
    </div>
  )
}
