/**
 * Purpose: Match page movement to navigation depth without delaying the next view.
 * Pattern: Keyed presence boundary.
 * Usage: Wraps the active view in src/ui/shell/App.tsx.
 * Related: src/ui/shell/App.tsx, src/ui/animation/use-reduced-motion-preference.ts
 */
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { ReactNode } from "react"
import { useReducedMotionPreference } from "./use-reduced-motion-preference"
import { motionTransition } from "./timing"

type PageDirection = "forward" | "back" | "replace"

function pageDirection(viewKey: string): PageDirection {
  if (viewKey === "home") return "back"
  if (viewKey === "board" || viewKey === "report") return "forward"
  return "replace" // The board hands off to simulation without a second slide.
}

export function PageTransition({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const reducedMotion = useReducedMotionPreference()
  const direction = pageDirection(viewKey)
  const transition = motionTransition(reducedMotion, "page")
  const variants = {
    enter: (kind: PageDirection) => ({ x: reducedMotion || kind === "replace" ? 0 : kind === "forward" ? 24 : -24,
      opacity: 1, transition }),
    center: { x: 0, opacity: 1, transition },
    exit: (kind: PageDirection) => ({ x: reducedMotion || kind === "replace" ? 0 : kind === "forward" ? -16 : 16,
      opacity: kind === "replace" ? 0 : 1, pointerEvents: "none" as const,
      transition: kind === "replace" ? { duration: 0 } : transition }),
  }
  return <div className="relative min-h-svh overflow-x-clip"><AnimatePresence mode="popLayout" custom={direction} initial={false}>
    <m.div key={viewKey} custom={direction} variants={variants} initial="enter" animate="center" exit="exit"
      className="relative min-h-svh w-full bg-background">
      {children}
    </m.div>
  </AnimatePresence></div>
}
