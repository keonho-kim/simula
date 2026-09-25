/**
 * Purpose: Animate user-initiated page changes without remounting unchanged view content.
 * Pattern: Keyed presence boundary.
 * Usage: Wraps the active view in src/ui/shell/App.tsx.
 * Related: src/ui/shell/App.tsx, src/ui/animation/use-reduced-motion-preference.ts
 */
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { ReactNode } from "react"
import { useReducedMotionPreference } from "./use-reduced-motion-preference"
import { slidePresence } from "./presence"

export function PageTransition({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const reducedMotion = useReducedMotionPreference()
  return <AnimatePresence mode="wait" initial={false}>
    <m.div key={viewKey} className="min-h-svh" {...slidePresence(reducedMotion, "y", 8, -8, "page")}>
      {children}
    </m.div>
  </AnimatePresence>
}
