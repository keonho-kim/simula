/**
 * Purpose: Configure a world batch and inspect/control one world without mounting sibling histories.
 * Pattern: Selected-world workflow composition.
 * Usage: Displayed from the confirmed scenario launch panel when Multiverse is enabled.
 * Related: src/ui/hooks/use-multiverse.ts, src/ui/components/multiverse/batch-world-list.tsx, src/ui/pages/simulations-page.tsx
 */
import type { ScenarioLaunchOptions } from "@/ui/models/scenario-builder/launch-options"
import { readWorldVisit, rememberWorldVisit } from "@/ui/browser-storage/world-navigation"
import { useEffect, useRef, useState } from "react"
import { MAX_BATCH_MINUTES, MAX_BATCH_WORLDS, type BatchWorld } from "@/shared/multiverse"
import type { UiTexts } from "@/ui/types/i18n"
import { useMultiverse } from "@/ui/hooks/use-multiverse"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { Input } from "@/ui/components/ui/input"
import { Switch } from "@/ui/components/ui/switch"
import { ArrowUpRightIcon, PlayIcon, SquareIcon, RotateCcwIcon, FileTextIcon } from "lucide-react"
import { BatchWorldList } from "./batch-world-list"
import { BatchOverview } from "./batch-overview"
import { batchStatusText, isActiveSimulation } from "./batch-world-status"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/ui/components/ui/field"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { WorldControlsFields } from "@/ui/components/scenario-builder/world-controls-fields"
import { BuilderActivity } from "@/ui/components/scenario-builder/builder-activity"

export function MultiversePanel({ initialOptions, autoContinue, scenarioId, fastMode, open, language, t, onOpenRun }: {
  initialOptions?: ScenarioLaunchOptions; autoContinue?: boolean; scenarioId: string; fastMode: boolean; open: boolean; language: "en" | "ko"; t: UiTexts; onOpenRun: (runId: string, view?: "simulation" | "report") => void
}) {
  const w = useMultiverse(scenarioId, fastMode, open, initialOptions, autoContinue)
  const [selectedId, setSelectedId] = useState<string>()
  const [origin] = useState(readWorldVisit)
  const panel = useRef<HTMLDivElement>(null)
  const restored = useRef(false)
  const returnId = origin?.batchId === w.batch?.id ? origin?.worldId : undefined
  const selected = w.batch?.worlds.find(world => world.id === (selectedId ?? returnId)) ?? w.batch?.worlds[0]
  useEffect(() => {
    if (restored.current || !returnId || selected?.id !== returnId) return
    // Restore after the parent page's initial heading focus and scroll reset.
    const frame = requestAnimationFrame(() => {
      restored.current = true
      panel.current?.scrollIntoView({ block: "start", behavior: "instant" })
      panel.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [returnId, selected?.id])
  const openWorld = (world: BatchWorld, view: "simulation" | "report") => {
    if (!world.runId || !w.batch) return
    rememberWorldVisit({ scenarioId, batchId: w.batch.id, worldId: world.id, runId: world.runId })
    onOpenRun(world.runId, view)
  }
  const selectWorld = (id: string) => {
    setSelectedId(id)
    const world = w.batch?.worlds.find(world => world.id === id)
    if (world?.runId && w.batch) rememberWorldVisit({ scenarioId, batchId: w.batch.id, worldId: world.id, runId: world.runId })
  }
  const reportWorld = selected?.runId ? selected : w.batch?.worlds.find(world => world.runId)
  const active = w.batch?.status === "running"
  const number = new Intl.NumberFormat(language)
  const name = (index: number) => t.batchWorld.replace("{index}", number.format(index))
  const worldActive = selected && isActiveSimulation(selected.status)
  return <div ref={panel} role="region" tabIndex={-1} aria-label={t.batchTitle} className="flex min-w-0 flex-col gap-4" data-testid="multiverse-panel">
    <p className="text-sm text-muted-foreground">{t.batchDescription}</p>
    {w.failed ? <Alert variant="destructive"><AlertDescription>{t.builderRequestError}</AlertDescription><Button variant="outline" size="sm" onClick={w.refresh}>{t.builderRefresh}</Button></Alert> : null}
    {!w.batch ? <form onSubmit={event => { event.preventDefault(); void w.create() }}>
      <FieldGroup className="simulation-setup-grid">
        <Field><FieldLabel htmlFor="batch-count">{t.batchWorldCount}</FieldLabel><Input id="batch-count" type="number" min={1} max={MAX_BATCH_WORLDS} required disabled={w.busy} value={w.request.worldCount} onChange={event => w.setRequest(current => ({ ...current, worldCount: Number(event.target.value) }))} /><FieldDescription>{t.batchWorldCountHelp.replace("{maximum}", number.format(MAX_BATCH_WORLDS))}</FieldDescription></Field>
        <WorldControlsFields prefix="batch" controls={w.request.controls} onChange={patch => w.setRequest(current => ({ ...current, controls: { ...current.controls, ...patch } }))} disabled={w.busy} t={t} />
        <Field><FieldLabel htmlFor="batch-duration">{t.batchDuration}</FieldLabel><Input id="batch-duration" type="number" min={1} max={MAX_BATCH_MINUTES} required disabled={w.busy} value={w.request.maxDurationMinutes} onChange={event => w.setRequest(current => ({ ...current, maxDurationMinutes: Number(event.target.value) }))} /><FieldDescription>{t.batchDurationHelp}</FieldDescription></Field>
        <Field orientation="horizontal"><FieldLabel htmlFor="batch-automatic">{t.autoContinue}</FieldLabel><Switch id="batch-automatic" checked={w.request.autoContinue} disabled={w.busy} onCheckedChange={enabled => w.setRequest(current => ({ ...current, autoContinue: enabled }))} /></Field>
        <p className="text-sm text-muted-foreground">{t.batchAutomaticHelp}</p>
        <Button type="submit" disabled={w.busy}>{t.batchStart}</Button>
      </FieldGroup>
    </form> : <>
      <BatchOverview batch={w.batch} language={language} t={t} actions={<>
        {reportWorld ? <Button variant={w.batch.status === "completed" ? "default" : "outline"} onClick={() => openWorld(reportWorld, "report")}><FileTextIcon data-icon="inline-start" />{t.batchOpenResult}</Button> : null}
        {active ? <Button variant="destructive" disabled={w.busy} onClick={() => void w.control("cancel")}><SquareIcon data-icon="inline-start" />{t.batchCancel}</Button> : null}
        {w.batch.status === "partial" || w.batch.status === "interrupted" ? <Button disabled={w.busy} onClick={() => void w.control("resume")}><RotateCcwIcon data-icon="inline-start" />{t.batchResume}</Button> : null}
        {!active ? <Button variant="outline" disabled={w.busy} onClick={w.reset}>{t.batchNew}</Button> : null}
      </>} />
      {w.batch.stopReason === "deadline" ? <Alert><AlertDescription>{t.batchDeadline}</AlertDescription></Alert> : null}
      {w.batch.status === "interrupted" || w.batch.worlds.some(world => world.status === "interrupted") ? <Alert><AlertDescription>{t.batchInterruptedHelp}</AlertDescription></Alert> : null}
      <div className="simulation-management-layout">
      <BatchWorldList worlds={w.batch.worlds} selectedId={selected?.id} onSelect={selectWorld} language={language} t={t} />
      {selected ? <section className="simulation-detail" aria-label={name(selected.index)}>
        <p className="workspace-eyebrow">{t.simulationsSelected}</p>
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold">{name(selected.index)}</h3><Badge variant="secondary" data-status={selected.status}>{batchStatusText(selected.status, t)}</Badge>
          {selected.roundIndex ? <span className="text-xs text-muted-foreground">{t.batchRound.replace("{index}", number.format(selected.roundIndex))}</span> : null}</div>
        {selected.status === "preparing" ? <div className="flex min-h-[280px] flex-col"><BuilderActivity key={selected.id} buildId={selected.id} channel="worlds" open={open} t={t} /></div> : null}
        {active && worldActive ? <Field className="simulation-progression" orientation="horizontal"><FieldLabel htmlFor="selected-world-auto">{t.autoContinue}</FieldLabel><Switch id="selected-world-auto" disabled={w.busy} checked={selected.autoContinue} onCheckedChange={enabled => void w.controlWorld(selected.id, { kind: "automatic", enabled })} /></Field> : null}
        {selected.status === "waiting" && selected.continueAt ? <p className="text-xs text-muted-foreground">{t.batchCountdown}</p> : null}
        <div className="simulation-detail-actions">
          <div className="flex flex-wrap gap-3">
          {active && selected.status === "waiting" && !selected.autoContinue && selected.roundIndex ? <Button disabled={w.busy} onClick={() => { if (selected.roundIndex) void w.controlWorld(selected.id, { kind: "continue", roundIndex: selected.roundIndex }) }}><PlayIcon data-icon="inline-start" />{t.batchContinue}</Button> : null}
          {selected.runId ? <Button variant={selected.status === "waiting" && !selected.autoContinue ? "secondary" : "default"} onClick={() => openWorld(selected, "simulation")}><ArrowUpRightIcon data-icon="inline-start" />{t.batchOpenWorld}</Button> : null}
          </div>
          {active && worldActive ? <Button variant="destructive" disabled={w.busy} onClick={() => void w.controlWorld(selected.id, { kind: "cancel" })}><SquareIcon data-icon="inline-start" />{t.batchCancelWorld}</Button> : null}
        </div>
      </section> : null}
      </div>
    </>}
  </div>
}
