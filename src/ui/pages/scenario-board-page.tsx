/**
 * Purpose: Show scenario preparation as a page with inspectable live details.
 * Pattern: Page composition with keyed presence transitions.
 * Usage: Lazy-loaded by src/ui/shell/App.tsx for the board route.
 * Related: src/ui/components/simulation/scenario-board-details.tsx, src/ui/models/simulation/scenario-board-items.ts
 */
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation } from "motion/react"
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import { ScenarioBoardDetails } from "@/ui/components/simulation/scenario-board-details"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { useRunStore } from "@/ui/stores/run-store"
import { useDocumentVisible } from "@/ui/animation/use-document-visible"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { activeRowMotion, progressDotMotion } from "@/ui/animation/activity"
import { fadePresence, slidePresence } from "@/ui/animation/presence"
import { boardProgress, type ScenarioBoardState } from "@/ui/models/simulation/scenario-board"
import { scenarioBoardColumns } from "@/ui/models/simulation/scenario-board-items"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"

const PROGRESS_DOTS = [0, 1, 2, 3, 4]
type BoardColumnModel = ReturnType<typeof scenarioBoardColumns>[number]

export const ScenarioBoardPage = memo(function ScenarioBoardPage({ t, onPrepared }: { t: UiTexts; onPrepared: () => void }) {
  const reducedMotion = useReducedMotionPreference()
  const documentVisible = useDocumentVisible()
  const still = reducedMotion || !documentVisible
  const runId = useRunStore(state => state.selectedRunId)
  const board = useRunStore(state => state.scenarioBoard)
  const [selectedId, setSelectedId] = useState<string>()
  const closeDetails = useCallback(() => setSelectedId(undefined), [])
  const columns = useMemo(() => scenarioBoardColumns(board, t), [board, t])
  const selectedColumn = columns.find(column => column.items.some(item => item.id === selectedId))
  const selected = selectedColumn?.items.find(item => item.id === selectedId)
  const progress = boardProgress(board)
  const activeColumn = columns.findIndex(column => column.items.some(item => !item.fields))
  const fallbackActiveId = columns[activeColumn]?.items.find(item => !item.fields)?.id
  const activeIds = new Set<string>(board.ready || board.terminal ? [] : board.activeActorIds.length
    ? board.activeActorIds : fallbackActiveId ? [fallbackActiveId] : [])
  const moving = board.started && !board.ready && !board.terminal && !still

  useEffect(() => {
    if (board.terminal || (board.ready && !selected)) onPrepared()
  }, [board.terminal, board.ready, selected, onPrepared])

  useEffect(() => {
    if (!selected) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetails()
    }
    window.addEventListener("keydown", onEscape)
    return () => window.removeEventListener("keydown", onEscape)
  }, [closeDetails, selected])

  return <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion={still ? "always" : "never"}>
      <main className="min-h-svh overflow-x-clip bg-background text-foreground">
        <header className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-3 border-b bg-background px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center">
              <AnimatePresence initial={false}>{selected ? <m.span key="back"
                {...slidePresence(still, "x", -6, 0, "quick")}>
                <Button variant="ghost" size="icon-sm" aria-label={t.boardBack} onClick={closeDetails}>
                  <ArrowLeft aria-hidden="true" />
                </Button>
              </m.span> : null}</AnimatePresence>
            </span>
            <h1 className="truncate text-base font-semibold">{t.scenarioBoardTitle}</h1>
          </div>
          <div role="progressbar" aria-label={t.boardProgress} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={progress} data-running={!board.ready && !board.terminal}
            className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            <span aria-hidden="true" className="inline-flex items-center gap-2">
              <span>[</span>
              <span>{PROGRESS_DOTS.map(index => <m.span key={index} className="scenario-progress-dot inline-block" {...progressDotMotion(moving, index)}>·</m.span>)}</span>
              <span className="inline-block w-[4ch] text-center">{progress === undefined ? "—" : `${progress}%`}</span>
              <span>{PROGRESS_DOTS.map(index => <m.span key={index} className="scenario-progress-dot inline-block" {...progressDotMotion(moving, index + PROGRESS_DOTS.length)}>·</m.span>)}</span>
              <span>]</span>
            </span>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6">
          <AnimatePresence initial={false}>
            {selected && selectedColumn ? <div key={`detail:${selectedColumn.title}`}
              className="flex min-h-[55svh] min-w-0 flex-col bg-background md:flex-row">
              <m.div className="min-w-0 p-1 md:w-2/5 md:shrink-0" {...slidePresence(still, "x", -28, 0, "reveal")}>
                <BoardColumn column={selectedColumn} board={board} activeIds={activeIds} selectedId={selectedId}
                  moving={moving} onSelect={setSelectedId} t={t} />
              </m.div>
              <m.aside aria-label={selected.title}
                className="flex min-w-0 flex-1 flex-col border-t bg-muted/20 md:border-l md:border-t-0"
                {...slidePresence(still, "x", 32, 0, "reveal")}>
                <AnimatePresence mode="wait" initial={false}>
                  <m.div key={selected.id} {...fadePresence(still, "quick")}>
                    <ScenarioBoardDetails item={selected} runId={runId} live={!board.ready && !board.terminal}
                      onClose={closeDetails} t={t} />
                  </m.div>
                </AnimatePresence>
              </m.aside>
            </div> : <div key="overview" className="min-w-0 bg-background">
              <m.div className="flex min-w-0 flex-wrap gap-5" {...slidePresence(still, "x", -12, 0, "reveal")}>
                {columns.map(column => <BoardColumn key={column.title} column={column} board={board}
                  activeIds={activeIds} selectedId={selectedId} moving={moving} onSelect={setSelectedId} t={t} />)}
              </m.div>
            </div>}
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  </LazyMotion>
})

const BoardColumn = memo(function BoardColumn({ column, board, activeIds, selectedId, moving, onSelect, t }: {
  column: BoardColumnModel
  board: ScenarioBoardState
  activeIds: ReadonlySet<string>
  selectedId?: string
  moving: boolean
  onSelect: (id: string) => void
  t: UiTexts
}) {
  const activeId = activeIds.has(selectedId ?? "") ? selectedId : activeIds.values().next().value
  const completed = column.items.every(item => item.fields)
  const working = column.items.some(item => activeIds.has(item.id))
  return <section aria-label={column.title} aria-busy={working}
    className="flex min-w-0 flex-[1_1_250px] flex-col">
    <h2 className="mb-3 flex shrink-0 items-center justify-between bg-muted/60 px-2 py-1.5 text-sm font-medium">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-label={completed ? t.boardDone : working ? t.boardWorking : t.boardPending}
          className={cn("size-2 shrink-0 rounded-full", completed ? "bg-blue-500" : working ? "bg-emerald-500" : "bg-slate-300")} />
        <span className="truncate">{column.title}</span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{column.items.filter(item => item.fields).length}</span>
    </h2>
    <div data-slot="board-column-list" role="group" aria-label={column.title} className="flex flex-col gap-1">
      {column.items.map(item => <button key={item.id} type="button"
        disabled={!item.fields && !activeIds.has(item.id) && !board.drafts[item.id]}
        aria-busy={activeIds.has(item.id)} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}
        className={cn("relative isolate flex w-full shrink-0 items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none enabled:hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground/60",
          selectedId === item.id && "bg-muted", activeIds.has(item.id) && "scenario-board-active text-foreground",
          activeIds.has(item.id) && item.id === activeId && "scenario-board-pulsing")}>
        {activeIds.has(item.id) ? <m.span aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-sm bg-emerald-100"
          {...activeRowMotion(moving && item.id === activeId)} /> : null}
        <span className={cn("shrink-0 font-mono", item.fields ? "text-blue-600" : activeIds.has(item.id) ? "text-emerald-600" : "text-muted-foreground")}
          aria-label={item.fields ? t.boardDone : activeIds.has(item.id) ? t.boardWorking : t.boardPending}>
          {item.fields ? "✓" : activeIds.has(item.id) ? "▸" : "·"}
        </span>
        <span className="min-w-0 break-words"><MarkdownContent generated={item.generatedTitle} inline content={item.title} /></span>
      </button>)}
    </div>
  </section>
})
