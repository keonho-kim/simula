/**
 * Purpose: Exclude exiting views from focus and accessibility while their visual transition finishes.
 * Pattern: Presence-owned accessible surface.
 * Usage: Wrap page and board views inside AnimatePresence.
 * Related: src/ui/animation/page-transition.tsx, src/ui/pages/scenario-board-page.tsx
 */
import { useIsPresent } from "motion/react"
import type { ReactNode } from "react"

export function PresenceSurface({ children, className }: { children: ReactNode; className?: string }) {
  const present = useIsPresent()
  return <div className={className} inert={!present} aria-hidden={!present || undefined}>{children}</div>
}
