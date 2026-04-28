import { FilterIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UiTexts } from "@/lib/i18n"
import {
  buildActorOptions,
  type ActorFilter,
  type ReportTimelineItem,
  type ReportTimelineRound,
} from "../report-view-model"
import { EmptyPanel } from "./ui"

export function TimelinePanel({
  actorFilter,
  actorOptions,
  rounds,
  t,
  onActorFilterChange,
  onActorSelect,
}: {
  actorFilter: ActorFilter
  actorOptions: ReturnType<typeof buildActorOptions>
  rounds: ReportTimelineRound[]
  t: UiTexts
  onActorFilterChange: (actorId: ActorFilter) => void
  onActorSelect: (actorId: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FilterIcon className="size-4" />
          <span>{rounds.length} {t.rounds}</span>
        </div>
        <Select value={actorFilter} onValueChange={onActorFilterChange}>
          <SelectTrigger size="sm" className="w-[240px]">
            <SelectValue placeholder={t.filterByActor} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t.allActors}</SelectItem>
              {actorOptions.map((actor) => (
                <SelectItem key={actor.id} value={actor.id}>
                  {actor.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <ScrollArea className="h-[calc(100svh-260px)] min-h-[520px] p-4">
        {rounds.length ? (
          <div className="flex flex-col gap-4 pr-3">
            {rounds.map((round) => (
              <TimelineRoundCard key={round.roundIndex} round={round} t={t} onActorSelect={onActorSelect} />
            ))}
          </div>
        ) : (
          <EmptyPanel title={t.noEventsMatch} body={t.noEventsMatchDescription} />
        )}
      </ScrollArea>
    </div>
  )
}

function TimelineRoundCard({
  round,
  t,
  onActorSelect,
}: {
  round: ReportTimelineRound
  t: UiTexts
  onActorSelect: (actorId: string) => void
}) {
  return (
    <article className="rounded-md border border-border/70 bg-background/80">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-sm">{t.round} {round.roundIndex}</Badge>
            {round.elapsedTime ? <Badge variant="secondary" className="rounded-sm">{round.elapsedTime}</Badge> : null}
          </div>
          <h3 className="mt-2 font-heading text-sm font-semibold">{round.title}</h3>
          {round.summary ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{round.summary}</p> : null}
        </div>
        <Badge variant="outline" className="rounded-md">
          {round.interactions.length} {t.interactions}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {round.preRound || round.afterRound ? (
          <div className="grid gap-3 md:grid-cols-2">
            {round.preRound ? <RoundNote label={t.preRound} value={round.preRound} /> : null}
            {round.afterRound ? <RoundNote label={t.afterRound} value={round.afterRound} /> : null}
          </div>
        ) : null}

        {round.interactions.length ? (
          <div className="flex flex-col gap-2">
            {round.interactions.map((interaction) => (
              <InteractionCard key={interaction.id} interaction={interaction} t={t} onActorSelect={onActorSelect} />
            ))}
          </div>
        ) : (
          <EmptyPanel title={t.noAdoptedInteractions} body={t.noAdoptedInteractionsDescription} compact />
        )}

        <RoundList title={t.keyInteractions} items={round.keyInteractions} />
        <RoundList title={t.actorImpacts} items={round.actorImpacts} />
        <RoundList title={t.unresolvedQuestions} items={round.unresolvedQuestions} />
      </div>
    </article>
  )
}

function InteractionCard({
  interaction,
  t,
  onActorSelect,
}: {
  interaction: ReportTimelineItem
  t: UiTexts
  onActorSelect: (actorId: string) => void
}) {
  return (
    <article className="rounded-md bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ActorButton actorId={interaction.sourceActorId} label={interaction.sourceName} onActorSelect={onActorSelect} />
          {interaction.targetActorIds.length ? (
            <span className="text-xs text-muted-foreground">{t.interactionTo}</span>
          ) : null}
          {interaction.targetActorIds.map((actorId, index) => (
            <ActorButton
              key={actorId}
              actorId={actorId}
              label={interaction.targetNames[index] ?? actorId}
              onActorSelect={onActorSelect}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="rounded-sm">{interaction.visibility}</Badge>
          <Badge variant="secondary" className="rounded-sm">{interaction.decisionType}</Badge>
          <Badge variant="outline" className="rounded-sm">{interaction.actionType}</Badge>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6">{interaction.content}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <MiniField label={t.intent} value={interaction.intent} />
        <MiniField label={t.expectation} value={interaction.expectation} />
      </div>
    </article>
  )
}

function RoundNote({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md bg-muted/25 p-3">
      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</h4>
      <p className="mt-1 text-xs leading-5">{value}</p>
    </section>
  )
}

function RoundList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null
  }
  return (
    <section className="rounded-md bg-muted/20 p-3">
      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground">{title}</h4>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs leading-5">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </section>
  )
}

function ActorButton({
  actorId,
  label,
  onActorSelect,
}: {
  actorId: string
  label: string
  onActorSelect: (actorId: string) => void
}) {
  return (
    <button
      type="button"
      className="max-w-[220px] truncate rounded-sm bg-background px-2 py-1 text-xs font-medium ring-1 ring-border/70 hover:ring-foreground/20"
      onClick={() => onActorSelect(actorId)}
    >
      {label}
    </button>
  )
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 p-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 text-xs leading-5">{value || "-"}</p>
    </div>
  )
}
