/**
 * Purpose: Fit simulation metrics, graph, and live chat into one viewport.
 * Pattern: Page composition with a bounded chat scroll surface.
 * Usage: Lazy-loaded by App for the simulation view.
 * Related: src/ui/components/simulation/simulation-stage.tsx, src/ui/components/actors/actor-rail.tsx
 */
import type { ReactNode } from "react"
import { ActorRail } from "@/ui/components/actors/actor-rail"
import { LlmMetricsPanel } from "@/ui/components/metrics/llm-metrics-panel"
import { SimulationStage } from "@/ui/components/simulation/simulation-stage"
import type { UiTexts } from "@/ui/types/i18n"
import "@/ui/styles/simulation.css"

export function SimulationPage({ toolbar, notice, children, t, selectedActorId, selectedEdgeId,
  onActorSelect, onActorExpand, onEdgeSelect, overlayOpen }: {
  toolbar: ReactNode
  notice?: ReactNode
  children?: ReactNode
  t: UiTexts
  selectedActorId?: string
  selectedEdgeId?: string
  onActorSelect: (id: string | undefined) => void
  onActorExpand: (id: string) => void
  onEdgeSelect: (id: string | undefined) => void
  overlayOpen: boolean
}) {
  return <main className="simulation-page h-dvh overflow-hidden bg-background text-foreground">
    <div className="mx-auto flex h-full min-h-0 w-full flex-col gap-3 px-4 py-3 lg:w-4/5 lg:px-0">
      <div className="shrink-0">{toolbar}{notice}</div>
      <div className="shrink-0"><LlmMetricsPanel t={t} /></div>
      <section className="flex min-h-0 flex-1 flex-col items-stretch gap-3 md:flex-row">
        <SimulationStage className="min-h-0 flex-[3] overflow-hidden" t={t}
          selectedActorId={selectedActorId} onActorSelect={onActorSelect} onActorExpand={onActorExpand}
          selectedEdgeId={selectedEdgeId} onEdgeSelect={onEdgeSelect} showActorPopover />
        <ActorRail t={t} onActorSelect={onActorExpand} className="min-h-0 flex-[2]" overlayOpen={overlayOpen} />
      </section>
      {children}
    </div>
  </main>
}
