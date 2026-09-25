/**
 * Purpose: Bound the scenario board's ambient dot and active-row effects.
 * Pattern: Pure animation preset.
 * Usage: Called only for the visible, running board's limited animated elements.
 * Related: src/ui/components/simulation/scenario-board.tsx, src/ui/animation/timing.ts
 */
import { MOTION_EASE, motionTransition } from "./timing"

export function boardLayoutTransition(reducedMotion: boolean) {
  return { type: "tween" as const, ...motionTransition(reducedMotion, "reveal"), ease: MOTION_EASE }
}

export function progressDotMotion(moving: boolean, index: number) {
  return {
    animate: moving ? { y: [0, -2, 0, 2, 0] } : { y: 0 },
    transition: moving
      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const, delay: index * -0.09 }
      : { duration: 0 },
  }
}

export function activeRowMotion(moving: boolean) {
  return {
    animate: { opacity: moving ? [0.25, 0.8, 0.25] : 0.65 },
    transition: moving
      ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 0 },
  }
}
