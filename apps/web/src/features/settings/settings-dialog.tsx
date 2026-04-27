import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"
import type { LLMSettings, ModelProvider, ModelRole } from "@simula/shared"
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
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchSettings, saveSettings } from "@/lib/api"

const roles: ModelRole[] = ["storyBuilder", "planner", "generator", "coordinator", "observer", "repair"]

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [draft, setDraft] = useState<LLMSettings | undefined>()
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchSettings })
  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (settings) => {
      setDraft(settings)
      toast.success("Settings saved")
    },
  })

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }
    const next = structuredClone(settingsQuery.data)
    for (const role of roles) {
      next[role].apiKey = ""
    }
    setDraft(next)
  }, [settingsQuery.data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] gap-4 overflow-hidden sm:max-w-[1080px]">
        <DialogHeader>
          <DialogTitle>LLM settings</DialogTitle>
          <DialogDescription>
            Role-based model settings. API keys are sent to the server and are not displayed after save.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[68svh] pr-3">
          {draft ? (
            <FieldGroup className="gap-3">
              {roles.map((role) => (
                <FieldSet key={role} className="rounded-lg bg-background/70 p-3 ring-1 ring-border/60">
                  <FieldTitle className="capitalize">{role}</FieldTitle>
                  <div className="grid gap-3 pt-2 md:grid-cols-2 xl:grid-cols-6">
                    <Field>
                      <FieldLabel>Provider</FieldLabel>
                      <Select
                        value={draft[role].provider}
                        onValueChange={(value) =>
                          setDraft({
                            ...draft,
                            [role]: { ...draft[role], provider: value as ModelProvider },
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="anthropic">Anthropic</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Model</FieldLabel>
                      <Input
                        value={draft[role].model}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [role]: { ...draft[role], model: event.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>API key</FieldLabel>
                      <Input
                        type="password"
                        value={draft[role].apiKey ?? ""}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [role]: { ...draft[role], apiKey: event.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Temperature</FieldLabel>
                      <Input
                        type="number"
                        step="0.1"
                        value={draft[role].temperature}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [role]: { ...draft[role], temperature: Number(event.target.value) },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Max tokens</FieldLabel>
                      <Input
                        type="number"
                        value={draft[role].maxTokens}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [role]: { ...draft[role], maxTokens: Number(event.target.value) },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Timeout</FieldLabel>
                      <Input
                        type="number"
                        value={draft[role].timeoutSeconds}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            [role]: { ...draft[role], timeoutSeconds: Number(event.target.value) },
                          })
                        }
                      />
                    </Field>
                  </div>
                </FieldSet>
              ))}
            </FieldGroup>
          ) : (
            <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Loading settings...</div>
          )}
        </ScrollArea>

        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button disabled={!draft || saveMutation.isPending} onClick={() => draft && saveMutation.mutate(draft)}>
            <SaveIcon data-icon="inline-start" />
            Save settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
