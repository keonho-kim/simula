import { memo, useMemo, useState } from "react"
import { X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/ui/components/ui/dialog"
import { Button } from "@/ui/components/ui/button"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { useRunStore } from "@/ui/stores/run-store"
import { boardProgress } from "@/ui/models/simulation/scenario-board"
import { scenarioBoardColumns } from "@/ui/models/simulation/scenario-board-items"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"

const PROGRESS_DOTS = [0, 1, 2, 3, 4]

export const ScenarioBoard = memo(function ScenarioBoard({ t }: { t: UiTexts }) {
  const board = useRunStore(state => state.scenarioBoard)
  const [selectedId, setSelectedId] = useState<string>()
  const columns = useMemo(() => scenarioBoardColumns(board, t), [board, t])
  const selected = columns.flatMap(column => column.items).find(item => item.id === selectedId)
  const progress = boardProgress(board)
  const activeColumn = columns.findIndex(column => column.items.some(item => !item.fields))
  const activeIds = new Set(board.ready || board.terminal ? [] : board.activeActorIds.length ? board.activeActorIds : [columns[activeColumn]?.items.find(item => !item.fields)?.id])
  const selectedDraft = selected ? board.drafts[selected.id] : undefined
  const fieldLabels: Record<string, string> = { role: t.boardRole, backgroundHistory: t.boardBackground, personality: t.boardPersonality, preference: t.boardPreference,
    roster: t.actorCards, public: t.boardPublic, "semi-public": t.boardGroup, private: t.boardPrivate, solitary: t.boardSolitary,
    coreSituation: t.boardCore, actorPressures: t.boardPressures, conflictDynamics: t.boardConflict, simulationDirection: t.boardDirection, majorEvents: t.boardEvents }
  const visible = board.started && !board.terminal && (!board.ready || Boolean(selected))
  return (
    <Dialog open={visible}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}
        onEscapeKeyDown={event => { event.preventDefault(); setSelectedId(undefined) }}
        onInteractOutside={event => event.preventDefault()}
        className="flex h-[min(86svh,900px)] max-h-[calc(100svh-2rem)] w-[92vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <DialogTitle>{t.scenarioBoardTitle}</DialogTitle>
          <div role="progressbar" aria-label={t.boardProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
            data-running={!board.ready && !board.terminal}
            className="font-mono text-xs tabular-nums text-muted-foreground">
            <span aria-hidden="true" className="inline-flex items-center gap-2">
              <span>[</span>
              <span>{PROGRESS_DOTS.map(index => <span key={index} className="scenario-progress-dot" style={{ animationDelay: `${index * -90}ms` }}>·</span>)}</span>
              <span className="inline-block w-[4ch] text-center">{progress === undefined ? "—" : `${progress}%`}</span>
              <span>{PROGRESS_DOTS.map(index => <span key={index} className="scenario-progress-dot" style={{ animationDelay: `${(index + 5) * -90}ms` }}>·</span>)}</span>
              <span>]</span>
            </span>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div aria-label={t.scenarioBoardTitle} className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden p-5">
            <div className="grid h-full min-h-0 min-w-[880px] grid-cols-4 gap-5">
              {columns.map((column) => (
                <section key={column.title} aria-label={column.title} aria-busy={column.items.some(item => activeIds.has(item.id))} className="flex min-h-0 min-w-0 flex-col">
                  <h3 className="mb-3 flex shrink-0 items-center justify-between bg-muted/60 px-2 py-1.5 text-sm font-medium">
                    <span className="flex items-center gap-2"><span aria-label={column.items.every(item => item.fields) ? t.boardDone : column.items.some(item => activeIds.has(item.id)) ? t.boardWorking : t.boardPending} className={cn("size-2 shrink-0 rounded-full", column.items.every(item => item.fields) ? "bg-blue-500" : column.items.some(item => activeIds.has(item.id)) ? "bg-emerald-500" : "bg-slate-300")} />{column.title}</span><span className="font-mono text-xs text-muted-foreground">{column.items.filter(item => item.fields).length}</span>
                  </h3>
                  <div data-slot="board-column-list" tabIndex={0} role="group" aria-label={column.title} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain">
                    {column.items.map(item => (
                      <button key={item.id} type="button" disabled={!item.fields && !activeIds.has(item.id) && !board.drafts[item.id]}
                        aria-busy={activeIds.has(item.id)} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}
                        className={cn("relative isolate flex w-full shrink-0 items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground/60", selectedId === item.id && "bg-muted", activeIds.has(item.id) && "scenario-board-active text-foreground") }>
                        <span className={cn("shrink-0 font-mono", item.fields ? "text-blue-600" : activeIds.has(item.id) ? "text-emerald-600" : "text-muted-foreground")} aria-label={item.fields ? t.boardDone : activeIds.has(item.id) ? t.boardWorking : t.boardPending}>
                          {item.fields ? "✓" : activeIds.has(item.id) ? "▸" : "·"}
                        </span>
                        <span className="min-w-0 break-words">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
          {selected ? (
            <aside aria-label={selected.title} className="flex min-h-0 basis-1/2 flex-col border-t bg-muted/20 md:w-[36%] md:min-w-80 md:basis-auto md:border-l md:border-t-0">
              <header className="flex shrink-0 items-center justify-between gap-2 border-b px-5 py-3">
                <h3 className="text-sm font-semibold">{selected.title}</h3>
                <Button variant="ghost" size="icon-sm" aria-label={t.boardClose} onClick={() => setSelectedId(undefined)}><X /></Button>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5">
                {!selected.fields ? <>
                  <p className="text-xs text-muted-foreground">{t.boardDraft}</p>
                  {selectedDraft && Object.values(selectedDraft).some(Boolean) ? Object.entries(selectedDraft).map(([field, content]) => (
                    <section key={field}><h4 className="mb-2 text-xs font-medium text-muted-foreground">{fieldLabels[field] ?? t.boardWorking}</h4>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{content}</p>
                    </section>
                  )) : <p role="status" className="text-sm text-muted-foreground">{t.boardAwaiting}</p>}
                </> : null}
                {selected.fields?.map((field, index) => (
                  <section key={index}>
                    {field.label ? <h4 className="mb-2 text-xs font-medium text-muted-foreground">{field.label}</h4> : null}
                    <MarkdownContent compact content={field.content} fallback="" />
                  </section>
                ))}
              </div>
            </aside>
          ) : null}
        </div>
        {board.ready && selected ? <footer className="flex justify-end border-t px-5 py-3"><Button onClick={() => setSelectedId(undefined)}>{t.boardEnter}</Button></footer> : null}
      </DialogContent>
    </Dialog>
  )
})
