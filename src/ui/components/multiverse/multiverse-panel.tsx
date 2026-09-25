/**
 * Purpose: Configure a world batch and inspect/control one world without mounting sibling histories.
 * Pattern: Selected-world workflow composition.
 * Usage: Displayed from the confirmed scenario launch panel when Multiverse is enabled.
 * Related: src/ui/hooks/use-multiverse.ts, src/ui/components/scenario-builder/builder-activity.tsx
 */
import { useState } from "react"
import { MAX_BATCH_MINUTES, MAX_BATCH_WORLDS, type BatchWorldStatus } from "@/shared/multiverse"
import type { UiTexts } from "@/ui/types/i18n"
import { useMultiverse } from "@/ui/hooks/use-multiverse"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { Input } from "@/ui/components/ui/input"
import { Switch } from "@/ui/components/ui/switch"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/ui/select"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/ui/components/ui/field"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { WorldControlsFields } from "@/ui/components/scenario-builder/world-controls-fields"
import { BuilderActivity } from "@/ui/components/scenario-builder/builder-activity"

export function MultiversePanel({ scenarioId, fastMode, open, language, t, onOpenRun }: {
  scenarioId: string; fastMode: boolean; open: boolean; language: "en" | "ko"; t: UiTexts; onOpenRun: (runId: string, view?: "simulation" | "report") => void
}) {
  const w = useMultiverse(scenarioId, fastMode, open)
  const [selectedId, setSelectedId] = useState<string>()
  const selected = w.batch?.worlds.find(world => world.id === selectedId) ?? w.batch?.worlds[0]
  const active = w.batch?.status === "running"
  const number = new Intl.NumberFormat(language)
  const name = (index: number) => t.batchWorld.replace("{index}", number.format(index))
  const worldActive = selected && ["pending", "preparing", "running", "waiting"].includes(selected.status)
  const counts = w.batch?.worlds.reduce<Partial<Record<BatchWorldStatus, number>>>((counts, world) => {
    counts[world.status] = (counts[world.status] ?? 0) + 1
    return counts
  }, {})
  return <div className="flex min-w-0 flex-col gap-4" data-testid="multiverse-panel">
    <p className="text-sm text-muted-foreground">{t.batchDescription}</p>
    {w.failed ? <Alert variant="destructive"><AlertDescription>{t.builderRequestError}</AlertDescription><Button variant="outline" size="sm" onClick={w.refresh}>{t.builderRefresh}</Button></Alert> : null}
    {!w.batch ? <form onSubmit={event => { event.preventDefault(); void w.create() }}>
      <FieldGroup>
        <Field><FieldLabel htmlFor="batch-count">{t.batchWorldCount}</FieldLabel><Input id="batch-count" type="number" min={1} max={MAX_BATCH_WORLDS} required disabled={w.busy} value={w.request.worldCount} onChange={event => w.setRequest(current => ({ ...current, worldCount: Number(event.target.value) }))} /><FieldDescription>{t.batchWorldCountHelp.replace("{maximum}", number.format(MAX_BATCH_WORLDS))}</FieldDescription></Field>
        <WorldControlsFields prefix="batch" controls={w.request.controls} onChange={patch => w.setRequest(current => ({ ...current, controls: { ...current.controls, ...patch } }))} disabled={w.busy} t={t} />
        <Field><FieldLabel htmlFor="batch-duration">{t.batchDuration}</FieldLabel><Input id="batch-duration" type="number" min={1} max={MAX_BATCH_MINUTES} required disabled={w.busy} value={w.request.maxDurationMinutes} onChange={event => w.setRequest(current => ({ ...current, maxDurationMinutes: Number(event.target.value) }))} /><FieldDescription>{t.batchDurationHelp}</FieldDescription></Field>
        <Field orientation="horizontal"><FieldLabel htmlFor="batch-automatic">{t.autoContinue}</FieldLabel><Switch id="batch-automatic" checked={w.request.autoContinue} disabled={w.busy} onCheckedChange={enabled => w.setRequest(current => ({ ...current, autoContinue: enabled }))} /></Field>
        <p className="text-sm text-muted-foreground">{t.batchAutomaticHelp}</p>
        <Button type="submit" disabled={w.busy}>{t.batchStart}</Button>
      </FieldGroup>
    </form> : <>
      <Badge variant="secondary">{batchStatusText(w.batch.status, t)}</Badge>
      <p role="status">{t.batchSummary.replace("{total}", number.format(w.batch.worlds.length)).replace("{completed}", number.format(counts?.completed ?? 0))
        .replace("{failed}", number.format(counts?.failed ?? 0)).replace("{canceled}", number.format(counts?.canceled ?? 0)).replace("{interrupted}", number.format(counts?.interrupted ?? 0))}</p>
      {w.batch.stopReason === "deadline" ? <Alert><AlertDescription>{t.batchDeadline}</AlertDescription></Alert> : null}
      {w.batch.status === "interrupted" || w.batch.worlds.some(world => world.status === "interrupted") ? <Alert><AlertDescription>{t.batchInterruptedHelp}</AlertDescription></Alert> : null}
      <Field><FieldLabel htmlFor="batch-world">{t.batchSelect}</FieldLabel>
        <Select value={selected?.id} onValueChange={setSelectedId}><SelectTrigger id="batch-world"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>{w.batch.worlds.map(world => <SelectItem key={world.id} value={world.id}>{name(world.index)} · {batchStatusText(world.status, t)}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </Field>
      {selected ? <section className="flex min-w-0 flex-col gap-3" aria-label={name(selected.index)}>
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">{name(selected.index)}</h3><Badge variant="outline">{batchStatusText(selected.status, t)}</Badge>
          {selected.roundIndex ? <span className="text-xs text-muted-foreground">{t.batchRound.replace("{index}", number.format(selected.roundIndex))}</span> : null}</div>
        {selected.status === "preparing" ? <div className="flex min-h-[280px] flex-col"><BuilderActivity key={selected.id} buildId={selected.id} channel="worlds" open={open} t={t} /></div> : null}
        {active && worldActive ? <Field orientation="horizontal"><FieldLabel htmlFor="selected-world-auto">{t.autoContinue}</FieldLabel><Switch id="selected-world-auto" disabled={w.busy} checked={selected.autoContinue} onCheckedChange={enabled => void w.controlWorld(selected.id, { kind: "automatic", enabled })} /></Field> : null}
        {selected.status === "waiting" && selected.continueAt ? <p className="text-xs text-muted-foreground">{t.batchCountdown}</p> : null}
        <div className="flex flex-wrap gap-2">
          {active && selected.status === "waiting" && !selected.autoContinue && selected.roundIndex ? <Button disabled={w.busy} onClick={() => { if (selected.roundIndex) void w.controlWorld(selected.id, { kind: "continue", roundIndex: selected.roundIndex }) }}>{t.batchContinue}</Button> : null}
          {selected.runId ? <Button variant="outline" onClick={() => { if (selected.runId) onOpenRun(selected.runId, ["completed", "failed", "canceled", "interrupted"].includes(selected.status) ? "report" : "simulation") }}>{selected.status === "completed" || selected.status === "failed" ? t.batchOpenResult : t.batchOpenWorld}</Button> : null}
          {active && worldActive ? <Button variant="outline" disabled={w.busy} onClick={() => void w.controlWorld(selected.id, { kind: "cancel" })}>{t.batchCancelWorld}</Button> : null}
        </div>
      </section> : null}
      <div className="flex flex-wrap gap-2">
        {active ? <Button variant="outline" disabled={w.busy} onClick={() => void w.control("cancel")}>{t.batchCancel}</Button> : null}
        {w.batch.status === "partial" || w.batch.status === "interrupted" ? <Button variant="outline" disabled={w.busy} onClick={() => void w.control("resume")}>{t.batchResume}</Button> : null}
        {!active ? <Button variant="ghost" disabled={w.busy} onClick={w.reset}>{t.batchNew}</Button> : null}
      </div>
    </>}
  </div>
}

function batchStatusText(status: BatchWorldStatus | "partial", t: UiTexts): string {
  return { pending: t.batchPending, preparing: t.batchPreparing, running: t.batchRunning, waiting: t.batchWaiting, completed: t.batchCompleted,
    failed: t.batchFailed, canceled: t.batchCanceled, interrupted: t.batchInterrupted, partial: t.batchPartial }[status]
}
