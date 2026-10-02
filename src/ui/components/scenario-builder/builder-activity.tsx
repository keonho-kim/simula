/**
 * Purpose: Navigate generation stages, their semantic targets, and each target's individual steps.
 * Pattern: Master-detail composition with an independent progress subscription.
 * Usage: Mounted during shared scenario and individual world preparation.
 * Related: src/ui/models/scenario-builder/preparation-groups.ts, src/ui/components/scenario-builder/builder-task-output.tsx, src/ui/styles/builder-generation.css
 */
import { useEffect, useId, useMemo, useRef, useState } from "react"
import * as m from "motion/react-m"
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { BUILDER_STAGES, builderTaskStage } from "@/ui/models/scenario-builder/progress"
import { groupBuilderTasks, type BuilderChannel, type BuilderGroup } from "@/ui/models/scenario-builder/preparation-groups"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { quietPresence } from "@/ui/animation/presence"
import { scenarioSourceName } from "@/ui/models/scenario-builder/source-name"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/components/ui/tabs"
import type { UiTexts } from "@/ui/types/i18n"
import type { DocumentSet } from "@/shared/documents"
import { BuilderTaskOutput } from "./builder-task-output"
import "@/ui/styles/builder-generation.css"

export function BuilderActivity({ buildId, open, documents, t, channel = "scenario-builder" }: {
  buildId: string; open: boolean; documents?: DocumentSet; t: UiTexts; channel?: BuilderChannel
}) {
  const reducedMotion = useReducedMotionPreference()
  const [stage, setStage] = useState<typeof BUILDER_STAGES[number]>()
  const [targetId, setTargetId] = useState<string>()
  const [stepId, setStepId] = useState<string>()
  const progress = useGenerationStream(buildId, undefined, open, channel)
  const documentNames = useMemo(() => new Map(documents?.documents.map(document => [document.id, scenarioSourceName(document.name, t)])), [documents, t])
  const groups = useMemo(() => groupBuilderTasks(progress.tasks, { t, channel, documentNames, terminal: progress.terminal }),
    [progress.tasks, progress.terminal, t, channel, documentNames])
  const latest = progress.tasks.at(-1)
  const currentStage = stage ?? (latest ? builderTaskStage(latest.kind) : channel === "worlds" ? "situation" : "sources")
  const targets = groups.filter(group => group.stage === currentStage)
  const group = targets.find(target => target.id === targetId)
  const selected = group?.steps.find(step => step.task.taskId === stepId)
  const root = useRef<HTMLElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  const outputHeading = useRef<HTMLHeadingElement>(null)
  const returnFocus = useRef<{ kind: "target" | "step"; id: string } | undefined>(undefined)
  const labelId = useId()
  useEffect(() => {
    const origin = returnFocus.current
    if (origin) {
      const buttons = root.current?.querySelectorAll<HTMLButtonElement>(`button[data-builder-${origin.kind}]`)
      const target = buttons && [...buttons].find(button => button.getAttribute(`data-builder-${origin.kind}`) === origin.id)
      target?.focus({ preventScroll: true })
      returnFocus.current = undefined
    } else if (stepId) outputHeading.current?.focus({ preventScroll: true })
    else if (targetId) back.current?.focus({ preventScroll: true })
  }, [targetId, stepId])
  const goBack = () => {
    if (stepId) { returnFocus.current = { kind: "step", id: stepId }; setStepId(undefined) }
    else if (targetId) { returnFocus.current = { kind: "target", id: targetId }; setTargetId(undefined) }
  }
  const changeStage = (value: string) => {
    const next = BUILDER_STAGES.find(candidate => candidate === value)
    if (!next) return
    setStage(next); setTargetId(undefined); setStepId(undefined); returnFocus.current = undefined
  }
  return <section ref={root} className="builder-generation" aria-label={t.builderStatusRunning} onKeyDown={event => {
    if (event.key === "Escape" && group) { event.stopPropagation(); goBack() }
  }}>
    <Tabs value={currentStage} onValueChange={changeStage}>
      <TabsList variant="line" className="builder-generation-stages" aria-label={t.builderGenerationStages}>
        {BUILDER_STAGES.filter(value => channel !== "worlds" || value !== "sources").map(value =>
          <TabsTrigger key={value} value={value}>{builderLabel(value, t)}</TabsTrigger>)}
      </TabsList>
      <TabsContent value={currentStage}>
        <header className="builder-generation-header">
          {group ? <Button ref={back} variant="outline" onClick={goBack}><ArrowLeftIcon data-icon="inline-start" />
            {stepId ? t.builderBackToSteps : t.builderBackToTargets}</Button> : null}
          <nav aria-label={t.builderGenerationPath}><ol>
            <li>{group ? <Button variant="link" size="sm" onClick={() => { returnFocus.current = { kind: "target", id: group.id }; setTargetId(undefined); setStepId(undefined) }}>
              {builderLabel(currentStage, t)}</Button> : <span aria-current="step">{builderLabel(currentStage, t)}</span>}</li>
            {group ? <li><ChevronRightIcon aria-hidden="true" />{selected ? <Button variant="link" size="sm" onClick={() => { returnFocus.current = { kind: "step", id: selected.task.taskId }; setStepId(undefined) }}>{group.title}</Button>
              : <span aria-current="step">{group.title}</span>}</li> : null}
            {selected ? <li><ChevronRightIcon aria-hidden="true" /><span aria-current="step">{selected.title}</span></li> : null}
          </ol></nav>
        </header>
        {progress.disconnected && !progress.terminal ? <p className="text-sm text-muted-foreground" role="status">{t.builderReconnecting}</p> : null}
        <m.div key={group?.id ?? currentStage} {...quietPresence(reducedMotion)}>
          <div className="builder-generation-context"><h2>{group?.title ?? t.builderTargets}</h2>
            <p>{group ? stepProgress(group, t) : t.builderSelectTarget}</p>
            {group ? <p>{t.builderStepCoverage}</p> : null}
          </div>
          {group ? <div className="builder-generation-detail-layout">
            <section className="builder-generation-step-list" aria-label={t.builderSteps}><h3>{t.builderSteps}</h3>
              {group.steps.map((step, index) => <Button key={step.task.taskId} variant={stepId === step.task.taskId ? "secondary" : "outline"}
                className="builder-generation-step" data-builder-step={step.task.taskId} aria-label={step.title}
                aria-describedby={`${labelId}-step-${index}`} aria-pressed={stepId === step.task.taskId}
                onClick={() => setStepId(step.task.taskId)}>
                <span>{step.title}</span><span id={`${labelId}-step-${index}`} className="builder-generation-meta">{builderLabel(step.task.status, t)}</span>
              </Button>)}
            </section>
            <aside className="builder-generation-output" aria-label={selected?.title ?? t.builderSummary}>
              {selected ? <><header><p>{group.title}</p><h3 ref={outputHeading} tabIndex={-1}>{selected.title}</h3>
                <Badge variant="secondary" data-status={selected.task.status}>{builderLabel(selected.task.status, t)}</Badge></header>
                <BuilderTaskOutput key={selected.task.taskId} buildId={buildId} executionId={progress.executionId} task={selected.task} channel={channel}
                  open={open} live={!progress.terminal} t={t} />
              </> : <p>{t.builderSelectStep}</p>}
            </aside>
          </div> : targets.length ? <div className="builder-generation-targets" aria-label={t.builderTargets}>
            {targets.map((target, index) => <Button key={target.id} variant="outline" className="builder-generation-target"
              data-builder-target={target.id} aria-label={target.title} aria-describedby={`${labelId}-target-${index}`}
              onClick={() => { setStage(currentStage); setTargetId(target.id); setStepId(undefined) }}>
              <span className="builder-generation-target-heading"><span>{target.title}</span><ChevronRightIcon aria-hidden="true" /></span>
              <span id={`${labelId}-target-${index}`} className="builder-generation-meta">
                <span>{target.status === "running" && target.completed === target.steps.length
                  ? t.builderReceivedComplete : builderLabel(target.status, t)}</span><span>{stepProgress(target, t)}</span>
              </span>
            </Button>)}
          </div> : <p className="text-sm text-muted-foreground">{t.builderTargetsPending}</p>}
        </m.div>
      </TabsContent>
    </Tabs>
  </section>
}

function stepProgress(group: BuilderGroup, t: UiTexts): string {
  return t.builderStepProgress.replace("{completed}", String(group.completed)).replace("{total}", String(group.steps.length))
}
