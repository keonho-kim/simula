/**
 * Purpose: Keep repeated fade and short slide presence behavior consistent.
 * Pattern: Pure animation preset.
 * Usage: Spread onto Motion elements in pages, reports, builders, and popups.
 * Related: src/ui/animation/timing.ts, src/ui/animation/use-reduced-motion-preference.ts
 */
import { motionTransition, type MotionTempo } from "./timing"

export function fadePresence(reducedMotion: boolean, tempo: MotionTempo = "content") {
  return {
    initial: { opacity: reducedMotion ? 1 : 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: motionTransition(reducedMotion, tempo),
  }
}

export function slidePresence(
  reducedMotion: boolean,
  axis: "x" | "y",
  enterOffset: number,
  exitOffset: number,
  tempo: MotionTempo = "content",
) {
  return axis === "x" ? {
    initial: { opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : enterOffset },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: reducedMotion ? 0 : exitOffset },
    transition: motionTransition(reducedMotion, tempo),
  } : {
    initial: { opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : enterOffset },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reducedMotion ? 0 : exitOffset },
    transition: motionTransition(reducedMotion, tempo),
  }
}
