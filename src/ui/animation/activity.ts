/**
 * Purpose: Bound the scenario board's ambient dot and active-row effects.
 * Pattern: Pure animation preset.
 * Usage: Called only for the visible, running board's limited animated elements.
 * Related: src/ui/pages/scenario-board-page.tsx, src/ui/animation/presence.ts
 */

export function progressDotMotion(moving: boolean, index: number) {
  const active = moving && (index === 4 || index === 5)
  return {
    animate: active ? { y: [0, -2, 0, 2, 0] } : { y: 0 },
    transition: active
      ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const, delay: index === 4 ? 0 : -0.16 }
      : { duration: 0 },
  }
}

export function activeRowMotion(moving: boolean) {
  return {
    animate: { opacity: moving ? [0.4, 0.65, 0.4] : 0.55 },
    transition: moving
      ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const }
      : { duration: 0 },
  }
}
