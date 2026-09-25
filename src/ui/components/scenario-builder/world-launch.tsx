/**
 * Purpose: Choose individual or Multiverse execution for a confirmed scenario.
 * Pattern: Controlled launch workflow composition.
 * Usage: Displayed after the shared scenario is confirmed.
 * Related: src/ui/hooks/use-world-preparation.ts, src/ui/components/scenario-builder/builder-activity.tsx
 */
import { useEffect, useRef, useState } from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { UiTexts } from "@/ui/types/i18n"
import { useWorldPreparation } from "@/ui/hooks/use-world-preparation"
import { Button } from "@/ui/components/ui/button"
import { Switch } from "@/ui/components/ui/switch"
import { Field, FieldGroup, FieldLabel } from "@/ui/components/ui/field"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { BuilderActivity } from "./builder-activity"
import { WorldControlsFields } from "./world-controls-fields"
import { MultiversePanel } from "@/ui/components/multiverse/multiverse-panel"
import { readMultiverseSession } from "@/ui/browser-storage/multiverse-session"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { fadePresence, slidePresence } from "@/ui/animation/presence"

export function WorldLaunch({ scenarioId, fastMode, open, starting, autoContinue, onAutoContinueChange, onStart, onOpenRun, language, t }: {
  scenarioId: string; fastMode: boolean; open: boolean; starting: boolean; autoContinue: boolean;
  onOpenRun: (runId: string, view?: "simulation" | "report") => void; language: "en" | "ko";
  onAutoContinueChange: (value: boolean) => void; onStart: (worldId: string) => void; t: UiTexts
}) {
  const [multiple, setMultiple] = useState(() => !!readMultiverseSession(scenarioId))
  const reducedMotion = useReducedMotionPreference()
  const w = useWorldPreparation(scenarioId, fastMode, open && !multiple)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  const preparing = w.world?.status === "preparing"
  const phase = !w.world ? "setup" : preparing ? "preparing" : w.world.status === "ready" ? "ready" : "other"
  return <section className="flex flex-col gap-4 rounded-lg border p-4" aria-label={t.worldPrepareTitle}>
    <header><h2 ref={heading} tabIndex={-1} className="text-base font-semibold">{t.worldPrepareTitle}</h2><p className="mt-1 text-sm text-muted-foreground">{t.worldPrepareDescription}</p></header>
    <Field orientation="horizontal"><FieldLabel htmlFor="multiverse-enabled">{t.batchTitle}</FieldLabel><Switch id="multiverse-enabled" checked={multiple} disabled={preparing} onCheckedChange={setMultiple} /></Field>
    <AnimatePresence mode="wait" initial={false}>{multiple ? <m.div key="multiverse" {...fadePresence(reducedMotion)}><MultiversePanel scenarioId={scenarioId} fastMode={fastMode} open={open} language={language} t={t} onOpenRun={onOpenRun} /></m.div> :
    <m.div key="single" className="flex flex-col gap-4" {...fadePresence(reducedMotion)}>
    <AnimatePresence mode="wait" initial={false}><m.div key={phase} {...slidePresence(reducedMotion, "y", 4, -4, "quick")}>
    {!w.world ? <form onSubmit={event => { event.preventDefault(); void w.prepare() }}>
      <FieldGroup>
        <WorldControlsFields prefix="world" controls={w.controls} onChange={patch => w.setControls(current => ({ ...current, ...patch }))} disabled={w.busy} t={t} />
        <Button type="submit" disabled={w.busy}>{t.worldPrepareAction}</Button>
      </FieldGroup>
    </form> : null}
    {preparing && w.world ? <div className="flex min-h-[280px] flex-col gap-3"><p role="status">{t.worldPreparing}</p><BuilderActivity key={w.world.id} buildId={w.world.id} channel="worlds" open={open} t={t} /></div> : null}
    {w.failed || w.world?.status === "failed" ? <Alert variant="destructive"><AlertDescription>{t.builderRequestError}</AlertDescription><Button variant="outline" size="sm" onClick={w.refresh}>{t.builderRefresh}</Button></Alert> : null}
    {w.world?.status === "canceled" ? <p>{t.builderStatusCanceled}</p> : null}
    {w.world?.status === "ready" ? <div className="flex flex-col gap-3">
      <p className="text-sm">{w.world.story?.opening.summary}</p>
      <Field orientation="horizontal"><FieldLabel htmlFor="world-auto-continue">{t.autoContinue}</FieldLabel><Switch id="world-auto-continue" checked={autoContinue} onCheckedChange={onAutoContinueChange} /></Field>
      <Button disabled={starting} onClick={() => { if (w.world) onStart(w.world.id) }}>{w.world.runId ? t.worldOpenRun : t.worldStart}</Button>
    </div> : null}
    </m.div></AnimatePresence>
    <div className="flex flex-wrap gap-2">
      {preparing ? <Button variant="outline" disabled={w.busy} onClick={() => void w.control("cancel")}>{t.builderCancel}</Button> : null}
      {w.world && ["failed", "canceled"].includes(w.world.status) ? <Button disabled={w.busy} onClick={() => void w.control("retry")}>{t.builderRetry}</Button> : null}
      {w.world && !preparing ? <Button variant="ghost" disabled={w.busy || starting} onClick={w.reset}>{t.worldAnother}</Button> : null}
    </div>
    </m.div>}</AnimatePresence>
  </section>
}
