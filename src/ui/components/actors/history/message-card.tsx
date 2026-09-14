import { memo } from "react"
import { Button } from "@/ui/components/ui/button"
import type { ActorMessage } from "@/ui/models/actors/actor-conversation"
import type { UiTexts } from "@/ui/types/i18n"

export const ActorMessageCard = memo(function ActorMessageCard({ t, onActorSelect, ...message }: Omit<ActorMessage, "targets"> & { targets: string; t: UiTexts; onActorSelect: (id: string) => void }) {
  return (
    <article aria-label={message.actorName} className="rounded-xl border border-border/70 bg-white px-4 py-3.5">
      <header className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button variant="link" className="h-auto border-0 p-0 shadow-none" aria-label={t.actorRailInspect.replace("{name}", message.actorName)} onClick={() => onActorSelect(message.actorId)}>{message.actorName}</Button>
        {message.role ? <span className="text-xs text-muted-foreground">{message.role}</span> : null}
        {message.targets.length > 0 ? <span className="w-full break-words text-xs text-muted-foreground">→ {message.targets}</span> : null}
      </header>
      <div className="flex flex-col gap-3 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
        {message.thought ? <p aria-label={t.actorRailThought} className="text-muted-foreground">{message.thought}</p> : null}
        <p aria-label={t.actorRailAction} className="font-medium text-black">{message.decisionType === "no_action" ? t.actorRailNoAction : message.action}</p>
        {message.decisionType !== "no_action" && message.content ? <p aria-label={t.actorRailSpeech} className="text-black">{message.content}</p> : null}
      </div>
    </article>
  )
})
