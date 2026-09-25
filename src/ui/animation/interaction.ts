/**
 * Purpose: Share restrained card lift and press behavior across interactive views.
 * Pattern: Pure animation preset.
 * Usage: Used by landing tiles and report round cards.
 * Related: src/ui/animation/timing.ts, src/ui/pages/start-screen.tsx
 */
import { MOTION_EASE, motionTransition } from "./timing"

export const START_TILE_VARIANTS = {
  idle: { y: 0, scale: 1 },
  hover: { y: -2, scale: 1 },
  pressed: { y: 0, scale: 0.995 },
}

export const START_TILE_ICON_VARIANTS = {
  idle: { x: 0 },
  hover: { x: 3 },
  pressed: { x: 0 },
}

export function startTileMotion(reducedMotion: boolean) {
  return {
    initial: reducedMotion ? undefined : "idle",
    animate: reducedMotion ? undefined : "idle",
    whileHover: reducedMotion ? undefined : "hover",
    whileFocus: reducedMotion ? undefined : "hover",
    whileTap: reducedMotion ? undefined : "pressed",
    variants: reducedMotion ? undefined : START_TILE_VARIANTS,
    transition: { ...motionTransition(reducedMotion, "page"), ease: MOTION_EASE },
  }
}

export function roundCardMotion(reducedMotion: boolean) {
  return {
    whileHover: reducedMotion ? undefined : { y: -2 },
    whileTap: reducedMotion ? undefined : { scale: 0.99 },
    transition: motionTransition(reducedMotion, "quick"),
  }
}

export function tabPressMotion(reducedMotion: boolean) {
  return {
    whileTap: reducedMotion ? undefined : { scale: 0.98 },
    transition: motionTransition(reducedMotion, "feedback"),
  }
}
