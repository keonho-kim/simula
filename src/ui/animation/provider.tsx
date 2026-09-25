/**
 * Purpose: Provide Motion features for application and credential dialogs after browser startup.
 * Pattern: Animation composition boundary.
 * Usage: Loaded by src/ui/shell/client-root.tsx after browser storage opens.
 * Related: src/ui/shell/client-root.tsx, src/ui/animation/page-transition.tsx
 */
"use client"

import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import type { ReactNode } from "react"

export default function AnimationProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
}
