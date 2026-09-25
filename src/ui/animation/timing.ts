/**
 * Purpose: Define the shared timing scale for visible Motion transitions.
 * Pattern: Immutable animation policy.
 * Usage: Imported by animation presets and component-specific Motion controls.
 * Related: src/ui/animation/presence.ts, src/ui/animation/interaction.ts
 */
export const MOTION_SECONDS = {
  feedback: 0.1,
  popup: 0.12,
  quick: 0.14,
  detail: 0.15,
  content: 0.16,
  page: 0.18,
  reveal: 0.24,
} as const

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const

export type MotionTempo = keyof typeof MOTION_SECONDS

export function motionTransition(reducedMotion: boolean, tempo: MotionTempo) {
  return { duration: reducedMotion ? 0 : MOTION_SECONDS[tempo] }
}

export function controlTransition(reducedMotion: boolean, tempo: MotionTempo = "popup") {
  return { ...motionTransition(reducedMotion, tempo), ease: "easeOut" as const }
}
