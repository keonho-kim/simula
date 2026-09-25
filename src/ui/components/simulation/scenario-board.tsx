/**
 * Purpose: Present live scenario preparation progress and inspectable board details.
 * Pattern: Memoized presentation component.
 * Usage: Lazy-loaded by src/ui/shell/App.tsx during simulation setup.
 * Related: src/ui/animation/activity.ts, src/ui/models/simulation/scenario-board.ts
 */
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { AnimatePresence, LazyMotion, MotionConfig, domMax } from "motion/react"
import * as m from "motion/react-m"
import { ScenarioBoardDetails } from "./scenario-board-details"
import { memo, useMemo, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/ui/components/ui/dialog"
import { Button } from "@/ui/components/ui/button"
import { useRunStore } from "@/ui/stores/run-store"
import { useDocumentVisible } from "@/ui/animation/use-document-visible"
import { activeRowMotion, boardLayoutTransition, progressDotMotion } from "@/ui/animation/activity"
import { fadePresence } from "@/ui/animation/presence"
import { boardProgress } from "@/ui/models/simulation/scenario-board"
import { scenarioBoardColumns } from "@/ui/models/simulation/scenario-board-items"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"

const PROGRESS_DOTS = [0, 1, 2, 3, 4]

export const ScenarioBoard = memo(function ScenarioBoard({ t }: { t: UiTexts }) {
  const reducedMotion = useReducedMotionPreference()
  const documentVisible = useDocumentVisible()
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
  const moving = visible && !board.ready && documentVisible && !reducedMotion
  return (
    <LazyMotion features={domMax} strict>
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"} transition={boardLayoutTransition(reducedMotion)}>
    <Dialog open={visible}>
      <DialogContent showCloseButton={false} aria-describedby={undefined}
        onEscapeKeyDown={event => { event.preventDefault(); setSelectedId(undefined) }}
        onInteractOutside={event => event.preventDefault()}
        className="page-scroll-dialog page-scroll-dialog--wide gap-0 p-0">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <DialogTitle>{t.scenarioBoardTitle}</DialogTitle>
          <div role="progressbar" aria-label={t.boardProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
            data-running={!board.ready && !board.terminal}
            className="font-mono text-xs tabular-nums text-muted-foreground">
            <span aria-hidden="true" className="inline-flex items-center gap-2">
              <span>[</span>
              <span>{PROGRESS_DOTS.map(index => <m.span key={index} className="scenario-progress-dot inline-block" {...progressDotMotion(moving, index)}>·</m.span>)}</span>
              <span className="inline-block w-[4ch] text-center">{progress === undefined ? "—" : `${progress}%`}</span>
              <span>{PROGRESS_DOTS.map(index => <m.span key={index} className="scenario-progress-dot inline-block" {...progressDotMotion(moving, index + PROGRESS_DOTS.length)}>·</m.span>)}</span>
              <span>]</span>
            </span>
          </div>
        </header>
        {selected ? <div className="shrink-0 border-b px-5 py-2"><Button variant="ghost" size="sm" onClick={() => setSelectedId(undefined)}>← {t.boardBack}</Button></div> : null}
        <div className="flex flex-col md:flex-row">
          <div aria-label={t.scenarioBoardTitle} className={cn("min-w-0 p-5", selected ? "md:w-2/5" : "w-full")}>
            <div className="flex flex-wrap gap-5">
              {visibleColumns.map((column) => (
                <m.section layout={reducedMotion ? false : "position"} layoutDependency={Boolean(selected)} key={column.title} aria-label={column.title} aria-busy={column.items.some(item => activeIds.has(item.id))} className="flex min-w-0 flex-[1_1_250px] flex-col">
                  <h3 className="mb-3 flex shrink-0 items-center justify-between bg-muted/60 px-2 py-1.5 text-sm font-medium">
                    <span className="flex items-center gap-2"><span aria-label={column.items.every(item => item.fields) ? t.boardDone : column.items.some(item => activeIds.has(item.id)) ? t.boardWorking : t.boardPending} className={cn("size-2 shrink-0 rounded-full", column.items.every(item => item.fields) ? "bg-blue-500" : column.items.some(item => activeIds.has(item.id)) ? "bg-emerald-500" : "bg-slate-300")} />{column.title}</span><span className="font-mono text-xs text-muted-foreground">{column.items.filter(item => item.fields).length}</span>
                  </h3>
                  <div data-slot="board-column-list" tabIndex={0} role="group" aria-label={column.title} className="flex flex-col gap-1">
                    {column.items.map(item => (
                      <button key={item.id} type="button" disabled={!item.fields && !activeIds.has(item.id) && !board.drafts[item.id]}
                        aria-busy={activeIds.has(item.id)} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}
                        className={cn("relative isolate flex w-full shrink-0 items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground/60", selectedId === item.id && "bg-muted", activeIds.has(item.id) && "scenario-board-active text-foreground", activeIds.has(item.id) && item.id === (selected?.id ?? activeIds.values().next().value) && "scenario-board-pulsing") }>
                        {activeIds.has(item.id) ? <m.span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-sm bg-emerald-100"
                          {...activeRowMotion(moving && item.id === (selected?.id ?? activeIds.values().next().value))} /> : null}
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
          <AnimatePresence mode="wait" initial={false}>{selected ? (
            <m.aside key="detail" {...fadePresence(reducedMotion, "detail")} aria-label={selected.title} className="flex min-w-0 flex-col border-t bg-muted/20 md:w-3/5 md:border-l md:border-t-0">
              <ScenarioBoardDetails item={selected} runId={runId} live={!board.ready && !board.terminal} onClose={closeDetails} t={t} />
            </m.aside>
          ) : null}</AnimatePresence>
        </div>
        {board.ready && selected ? <footer className="flex justify-end border-t px-5 py-3"><Button onClick={() => setSelectedId(undefined)}>{t.boardEnter}</Button></footer> : null}
      </DialogContent>
    </Dialog>
    </MotionConfig>
    </LazyMotion>
  )
})
