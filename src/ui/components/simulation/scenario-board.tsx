/**
 * Purpose: Present live scenario preparation progress and inspectable board details.
 * Pattern: Memoized presentation component.
 * Usage: Lazy-loaded by src/ui/app/App.tsx during simulation setup.
 * Related: src/ui/styles/scenario-board.css, src/ui/models/simulation/scenario-board.ts
 */
import { useReducedMotionPreference } from "@/ui/hooks/use-reduced-motion-preference"
import { LazyMotion, MotionConfig, domMax } from "motion/react"
import * as m from "motion/react-m"
import { ScenarioBoardDetails } from "./scenario-board-details"
import { memo, useMemo, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/ui/components/ui/dialog"
import { Button } from "@/ui/components/ui/button"
import { useRunStore } from "@/ui/stores/run-store"
import { boardProgress } from "@/ui/models/simulation/scenario-board"
import { scenarioBoardColumns } from "@/ui/models/simulation/scenario-board-items"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"
import "@/ui/styles/scenario-board.css"

const PROGRESS_DOTS = [0, 1, 2, 3, 4]

export const ScenarioBoard = memo(function ScenarioBoard({ t }: { t: UiTexts }) {
  const reducedMotion = useReducedMotionPreference()
  const runId = useRunStore(state => state.selectedRunId)
  const board = useRunStore(state => state.scenarioBoard)
  const [selectedId, setSelectedId] = useState<string>()
  const closeDetails = useCallback(() => setSelectedId(undefined), [])
  const columns = useMemo(() => scenarioBoardColumns(board, t), [board, t])
  const selected = columns.flatMap(column => column.items).find(item => item.id === selectedId)
  const progress = boardProgress(board)
  const activeColumn = columns.findIndex(column => column.items.some(item => !item.fields))
  const activeIds = new Set(board.ready || board.terminal ? [] : board.activeActorIds.length ? board.activeActorIds : [columns[activeColumn]?.items.find(item => !item.fields)?.id])
  const selectedColumn = selected ? columns.find(column => column.items.some(item => item.id === selected.id)) : undefined
  const visibleColumns = selectedColumn ? [selectedColumn] : columns
  const visible = board.started && !board.terminal && (!board.ready || Boolean(selected))
  return (
    <LazyMotion features={domMax} strict>
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"} transition={{ type: "tween", duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}>
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
        {selected ? <div className="shrink-0 border-b px-5 py-2"><Button variant="ghost" size="sm" onClick={() => setSelectedId(undefined)}>← {t.boardBack}</Button></div> : null}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div aria-label={t.scenarioBoardTitle} className={cn("min-h-0 min-w-0 overflow-x-auto overflow-y-hidden p-5", selected ? "flex-1 md:w-2/5 md:flex-none" : "flex-1")}>
            <div className={cn("grid h-full min-h-0 gap-5", selected ? "grid-cols-1" : "min-w-[880px] grid-cols-4")}>
              {visibleColumns.map((column) => (
                <m.section layout={reducedMotion ? false : "position"} layoutDependency={Boolean(selected)} key={column.title} aria-label={column.title} aria-busy={column.items.some(item => activeIds.has(item.id))} className="flex min-h-0 min-w-0 flex-col">
                  <h3 className="mb-3 flex shrink-0 items-center justify-between bg-muted/60 px-2 py-1.5 text-sm font-medium">
                    <span className="flex items-center gap-2"><span aria-label={column.items.every(item => item.fields) ? t.boardDone : column.items.some(item => activeIds.has(item.id)) ? t.boardWorking : t.boardPending} className={cn("size-2 shrink-0 rounded-full", column.items.every(item => item.fields) ? "bg-blue-500" : column.items.some(item => activeIds.has(item.id)) ? "bg-emerald-500" : "bg-slate-300")} />{column.title}</span><span className="font-mono text-xs text-muted-foreground">{column.items.filter(item => item.fields).length}</span>
                  </h3>
                  <div data-slot="board-column-list" tabIndex={0} role="group" aria-label={column.title} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain">
                    {column.items.map(item => (
                      <button key={item.id} type="button" disabled={!item.fields && !activeIds.has(item.id) && !board.drafts[item.id]}
                        aria-busy={activeIds.has(item.id)} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}
                        className={cn("relative isolate flex w-full shrink-0 items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground/60", selectedId === item.id && "bg-muted", activeIds.has(item.id) && "scenario-board-active text-foreground", activeIds.has(item.id) && item.id === (selected?.id ?? activeIds.values().next().value) && "scenario-board-pulsing") }>
                        <span className={cn("shrink-0 font-mono", item.fields ? "text-blue-600" : activeIds.has(item.id) ? "text-emerald-600" : "text-muted-foreground")} aria-label={item.fields ? t.boardDone : activeIds.has(item.id) ? t.boardWorking : t.boardPending}>
                          {item.fields ? "✓" : activeIds.has(item.id) ? "▸" : "·"}
                        </span>
                        <span className="min-w-0 break-words">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </m.section>
              ))}
            </div>
          </div>
          {selected ? (
            <m.aside initial={{ opacity: reducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} aria-label={selected.title} className="flex min-h-0 basis-1/2 flex-col border-t bg-muted/20 min-w-0 md:w-3/5 md:basis-auto md:border-l md:border-t-0">
              <ScenarioBoardDetails item={selected} runId={runId} live={!board.ready && !board.terminal} onClose={closeDetails} t={t} />
            </m.aside>
          ) : null}
        </div>
        {board.ready && selected ? <footer className="flex justify-end border-t px-5 py-3"><Button onClick={() => setSelectedId(undefined)}>{t.boardEnter}</Button></footer> : null}
      </DialogContent>
    </Dialog>
    </MotionConfig>
    </LazyMotion>
  )
})
