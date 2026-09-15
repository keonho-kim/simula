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

export const ScenarioBoard = memo(function ScenarioBoard({ t }: { t: UiTexts }) {
  const board = useRunStore(state => state.scenarioBoard)
  const [selectedId, setSelectedId] = useState<string>()
  const columns = useMemo(() => scenarioBoardColumns(board, t), [board, t])
  const selected = columns.flatMap(column => column.items).find(item => item.id === selectedId && item.fields)
  const progress = boardProgress(board)
  const filled = Math.floor((progress ?? 0) / 5)
  const activeColumn = columns.findIndex(column => column.items.some(item => !item.fields))
  const activeItemId = columns[activeColumn]?.items.find(item => !item.fields)?.id
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
            className="font-mono text-xs tabular-nums text-muted-foreground">
            <span aria-hidden="true">[ {">".repeat(filled)}{"·".repeat(20 - filled)}{progress !== undefined ? ` ${progress}%` : ""} ]</span>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div aria-label={t.scenarioBoardTitle} className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
            <div className="grid min-w-[880px] grid-cols-4 items-start gap-5">
              {columns.map((column) => (
                <section key={column.title} aria-label={column.title} className="min-w-0">
                  <h3 className="mb-3 flex items-center justify-between bg-muted/60 px-2 py-1.5 text-sm font-medium">
                    {column.title}<span className="font-mono text-xs text-muted-foreground">{column.items.filter(item => item.fields).length}</span>
                  </h3>
                  <div className="flex flex-col gap-1">
                    {column.items.map(item => (
                      <button key={item.id} type="button" disabled={!item.fields}
                        aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}
                        className={cn("flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground/60", selectedId === item.id && "bg-muted") }>
                        <span className="shrink-0 font-mono text-muted-foreground" aria-label={item.fields ? t.boardDone : item.id === activeItemId ? t.boardWorking : t.boardPending}>
                          {item.fields ? "✓" : item.id === activeItemId ? "▸" : "·"}
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
