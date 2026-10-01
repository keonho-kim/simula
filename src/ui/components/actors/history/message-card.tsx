/**
 * Purpose: Render one actor's generated thought, action, and speech in the conversation history.
 * Pattern: Memoized presentation component.
 * Usage: Used by live and report actor conversation lists.
 * Related: src/ui/models/actors/actor-conversation.ts, src/ui/components/markdown/markdown-content.tsx
 */
import { Badge } from "@/ui/components/ui/badge"
import { memo } from "react"
import { Button } from "@/ui/components/ui/button"
import type { ActorMessage } from "@/ui/models/actors/actor-conversation"
import type { UiTexts } from "@/ui/types/i18n"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export const ActorMessageCard = memo(function ActorMessageCard({ t, onActorSelect, onMessageSelect, ...message }: Omit<ActorMessage, "targets"> & { targets: string; t: UiTexts; onActorSelect: (id: string) => void; onMessageSelect?: (id: string) => void }) {
  const solitary = message.visibility === "solitary"
  return (
    <article data-interaction-id={message.id} data-delivery={message.delivery} aria-label={message.actorName} className="actor-message-card rounded-lg border border-border bg-card px-4 py-3.5">
      {message.delivery ? <p className="mb-2 text-xs font-medium text-muted-foreground">{message.delivery === "pending" ? t.workspacePending : t.workspaceUnapplied}</p> : null}
      <header className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <Button variant="link" className="h-auto border-0 p-0 shadow-none" aria-label={t.actorRailInspect.replace("{name}", message.actorName)} onClick={() => onActorSelect(message.actorId)}><MarkdownContent generated inline content={message.actorName} /></Button>
        {message.role ? <MarkdownContent generated inline className="text-xs text-muted-foreground" content={message.role} /> : null}
        {message.targets.length > 0 ? <span className="w-full break-words text-xs text-muted-foreground">→ <MarkdownContent generated inline content={message.targets} /></span> : null}
      </header>
      <div className="flex flex-col gap-3 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
        {message.thought ? <MarkdownContent generated ariaLabel={t.actorRailThought} className="text-muted-foreground" content={message.thought} /> : null}
        <div className="flex items-start gap-2">
          <Badge variant="secondary" aria-label={t.actorRailAction} className="h-auto max-w-[45%] whitespace-normal break-words rounded-full px-2.5 py-0.5 text-xs leading-5">
            {message.decisionType === "no_action" ? t.actorRailNoAction : <MarkdownContent generated inline content={message.action} />}
          </Badge>
          {message.decisionType !== "no_action" && message.content ? (
            <div className="min-w-0 flex-1 text-foreground">
              {solitary ? <span className="block text-xs text-muted-foreground">{t.actorRailSolitaryAction}</span> : null}
              <MarkdownContent generated ariaLabel={solitary ? t.actorRailSolitaryAction : t.actorRailSpeech} content={message.content} />
            </div>
          ) : null}
        </div>
      </div>
      {onMessageSelect ? <Button variant="ghost" size="sm" className="mt-2" onClick={() => onMessageSelect(message.id)}>{t.reportMessageDetails}</Button> : null}
    </article>
  )
})
