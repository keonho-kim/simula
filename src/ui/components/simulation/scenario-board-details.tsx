import { memo } from "react"
import { X } from "lucide-react"
import { Button } from "@/ui/components/ui/button"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { useBoardPreview } from "@/ui/hooks/use-board-preview"
import type { BoardItem } from "@/ui/models/simulation/scenario-board-items"
import type { UiTexts } from "@/ui/types/i18n"

/** Streaming updates stay inside the detail body, outside the board's layout tree. */
export const ScenarioBoardDetails = memo(function ScenarioBoardDetails({ item, runId, live, onClose, t }: {
  item: BoardItem; runId?: string; live: boolean; onClose: () => void; t: UiTexts
}) {
  const preview = useBoardPreview(runId, !item.fields && live ? item.id : undefined)
  const selectedDraft = preview.fields
  const fieldLabels: Record<string, string> = { label: t.boardActionName, intentHint: t.boardIntent, expectedOutcome: t.boardOutcome, role: t.boardRole, backgroundHistory: t.boardBackground, personality: t.boardPersonality, preference: t.boardPreference,
    roster: t.actorCards, public: t.boardPublic, "semi-public": t.boardGroup, private: t.boardPrivate, solitary: t.boardSolitary,
    coreSituation: t.boardCore, actorPressures: t.boardPressures, conflictDynamics: t.boardConflict, simulationDirection: t.boardDirection, majorEvents: t.boardEvents }
  return <>
    <header className="flex shrink-0 items-center justify-between gap-2 border-b px-5 py-3">
      <h3 className="text-sm font-semibold">{item.title}</h3>
      <Button variant="ghost" size="icon-sm" aria-label={t.boardClose} onClick={onClose}><X /></Button>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5">
      {!item.fields ? <>
        <p className="text-xs text-muted-foreground">{t.boardDraft}</p>
        {selectedDraft && Object.values(selectedDraft).some(Boolean) ? Object.entries(selectedDraft).map(([field, content]) => (
          <section key={field}><h4 className="mb-2 text-xs font-medium text-muted-foreground">{fieldLabels[field] ?? t.boardWorking}</h4>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{content}</p>
          </section>
        )) : <p role="status" className="text-sm text-muted-foreground">{preview.disconnected ? t.boardReconnecting : t.boardAwaiting}</p>}
      </> : null}
      {item.fields?.map((field, index) => (
        <section key={index}>
          {field.label ? <h4 className="mb-2 text-xs font-medium text-muted-foreground">{field.label}</h4> : null}
          <MarkdownContent compact content={field.content} fallback="" />
        </section>
      ))}
    </div>
  </>
})
