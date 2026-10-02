/**
 * Purpose: Fit simulation metrics, graph, and live chat into one viewport.
 * Pattern: Page composition with a bounded chat scroll surface.
 * Usage: Lazy-loaded by App for the simulation view.
 * Related: src/ui/components/simulation/simulation-stage.tsx, src/ui/components/actors/actor-rail.tsx
 */
import { useEffect, useRef, type ReactNode } from "react"
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
  const page = useRef<HTMLElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
    page.current?.focus({ preventScroll: true })
  }, [])
  return <main ref={page} tabIndex={-1} className="simulation-page bg-background text-foreground outline-none">
    <div className="simulation-workspace">
      <div className="shrink-0">{toolbar}{notice}</div>
      <div className="shrink-0"><LlmMetricsPanel t={t} /></div>
      <section className="simulation-panels">
        <SimulationStage className="min-h-0 flex-[3] overflow-hidden" t={t}
          selectedActorId={selectedActorId} onActorSelect={onActorSelect} onActorExpand={onActorExpand}
          selectedEdgeId={selectedEdgeId} onEdgeSelect={onEdgeSelect} showActorPopover />
        <ActorRail t={t} onActorSelect={onActorExpand} className="min-h-0 flex-[2]" overlayOpen={overlayOpen} />
      </section>
      {children}
    </div>
  </main>
}
