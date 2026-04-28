import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { SparklesIcon } from "lucide-react"
import type { PromptLanguage, ScenarioControls, StoryBuilderMessage } from "@simula/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { draftScenario } from "@/lib/api"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"

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
  const [idea, setIdea] = useState("")
  const [draft, setDraft] = useState("")
  const [messages, setMessages] = useState<StoryBuilderMessage[]>([])
  const [controls, setControls] = useState<ScenarioControls>({
    numCast: 6,
    allowAdditionalCast: true,
    actionsPerType: 3,
    maxRound: 8,
    fastMode: false,
    actorContextTokenBudget: 2000,
  })
  const mutation = useMutation({
    mutationFn: draftScenario,
    onSuccess: (response) => setDraft(response.text),
  })

  const generateDraft = () => {
    const nextMessages = [
      ...messages,
      { role: "user" as const, content: idea.trim() },
    ].filter((message) => message.content)
    setMessages(nextMessages)
    mutation.mutate({ messages: nextMessages, controls, language: promptLanguage })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-hidden sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>{t.storyBuilder}</DialogTitle>
          <DialogDescription>{t.storyBuilderDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="story-builder-input">{t.builderInput}</FieldLabel>
              <Textarea
                id="story-builder-input"
                className="min-h-[180px]"
                value={idea}
                placeholder={t.builderPlaceholder}
                onChange={(event) => setIdea(event.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-[120px_120px_140px_minmax(0,1fr)]">
              <Field>
                <FieldLabel htmlFor="builder-cast-size">{t.castSize}</FieldLabel>
                <Input
                  id="builder-cast-size"
                  type="number"
                  min={1}
                  value={controls.numCast}
                  onChange={(event) =>
                    setControls({ ...controls, numCast: Number(event.target.value) })
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
                    setControls({ ...controls, maxRound: Number(event.target.value) })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="builder-actions-per-type">{t.actionsPerType}</FieldLabel>
                <Input
                  id="builder-actions-per-type"
                  type="number"
                  min={1}
                  value={controls.actionsPerType}
                  onChange={(event) =>
                    setControls({ ...controls, actionsPerType: Number(event.target.value) })
                  }
                />
              </Field>
              <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
                <Switch
                  id="builder-extra-cast"
                  checked={controls.allowAdditionalCast}
                  onCheckedChange={(allowAdditionalCast) =>
                    setControls({ ...controls, allowAdditionalCast })
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor="builder-extra-cast">{t.allowExtraCast}</FieldLabel>
                  <FieldDescription>{t.allowExtraCastHelp}</FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
                <Switch
                  id="builder-fast-mode"
                  checked={controls.fastMode}
                  onCheckedChange={(fastMode) =>
                    setControls({ ...controls, fastMode })
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor="builder-fast-mode">{t.fastMode}</FieldLabel>
                  <FieldDescription>{t.fastModeHelp}</FieldDescription>
                </FieldContent>
              </Field>
            </div>
            <Button disabled={!idea.trim() || mutation.isPending} onClick={generateDraft}>
              <SparklesIcon data-icon="inline-start" />
              {t.generateDraft}
            </Button>
          </FieldGroup>

          <div className="flex min-h-0 flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t.generatedDraft}</h3>
            </div>
            <ScrollArea className="h-[390px] rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
              <MarkdownContent content={draft} fallback={t.noDraftYet} />
            </ScrollArea>
            <Button
              disabled={!draft.trim()}
              onClick={() => {
                onUseDraft(draft, controls)
                onOpenChange(false)
              }}
            >
              {t.useDraft}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
