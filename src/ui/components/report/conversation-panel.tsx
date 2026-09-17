import { useMemo, useState } from "react"
import type { RunEvent, SimulationState } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { buildConversationBoard } from "@/ui/models/report/conversation-board"
import { VirtualActorHistory } from "@/ui/components/actors/history/virtual-history"
import { ActorDetailDialog } from "@/ui/components/actors/actor-panel"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/ui/components/ui/select"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { RoundCarousel } from "./round-carousel"
import { EmptyPanel } from "./presentation"

export function ReportConversationPanel({
  state,
  events,
  t
}: {
  state?: SimulationState
  events: RunEvent[]
  t: UiTexts
}) {
  const rounds = useMemo(() => buildConversationBoard(state, events), [state, events])
  const [selected, setSelected] = useState<number>()
  const [actorFilter, setActorFilter] = useState("all")
  const [actorId, setActorId] = useState<string>()
  const [messageId, setMessageId] = useState<string>()
  const round = rounds.find((item) => item.roundIndex === selected) ?? rounds[0]
  const interactions = useMemo(
    () => new Map(state?.interactions.map((item) => [item.id, item]) ?? []),
    [state]
  )
  const visible = useMemo(
    () =>
      round
        ? [
            {
              ...round,
              messages: round.messages.filter((message) => {
                const interaction = interactions.get(message.id)
                return (
                  actorFilter === "all" ||
                  message.actorId === actorFilter ||
                  interaction?.targetActorIds.includes(actorFilter)
                )
              })
            }
          ]
        : [],
    [round, actorFilter, interactions]
  )
  const detail = messageId ? interactions.get(messageId) : undefined
  if (!round) return <EmptyPanel title={t.noEventsMatch} body={t.noEventsMatchDescription} />
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RoundCarousel rounds={rounds} selected={round.roundIndex} onSelect={setSelected} t={t} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <h2 className="text-sm font-semibold">
          {t.round} {round.roundIndex} · {t.reportConversations}
        </h2>
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger aria-label={t.filterByActor} className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t.allActors}</SelectItem>
              {state?.actors.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <VirtualActorHistory
        key={`${round.roundIndex}:${actorFilter}`}
        rounds={visible}
        t={t}
        mode="archive"
        onActorSelect={setActorId}
        onMessageSelect={setMessageId}
      />
      {actorId ? (
        <ActorDetailDialog
          actorId={actorId}
          t={t}
          open
          onOpenChange={(open) => {
            if (!open) setActorId(undefined)
          }}
        />
      ) : null}
      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setMessageId(undefined)
        }}
      >
        <DialogContent className="max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.reportMessageDetails}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="flex flex-col gap-4">
              {[
                [t.intent, detail.intent],
                [t.expectation, detail.expectation]
              ].map(([label, content]) => (
                <section key={label}>
                  <h3 className="mb-2 text-sm font-medium">{label}</h3>
                  <MarkdownContent content={content ?? ""} fallback="—" />
                </section>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
