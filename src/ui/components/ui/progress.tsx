/**
 * Purpose: Expose accessible progress with Motion-owned indicator movement.
 * Pattern: Radix control composition.
 * Usage: Used by progress displays in browser workflows.
 * Related: src/ui/animation/use-reduced-motion-preference.ts, src/ui/animation/provider.tsx
 */
import * as React from "react"
import * as m from "motion/react-m"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/ui/lib/class-names"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { controlTransition } from "@/ui/animation/timing"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const reducedMotion = useReducedMotionPreference()
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator asChild><m.div data-slot="progress-indicator" className="size-full flex-1 bg-primary"
        initial={false} animate={{ x: `${(value ?? 0) - 100}%` }}
        transition={controlTransition(reducedMotion, "page")} />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
