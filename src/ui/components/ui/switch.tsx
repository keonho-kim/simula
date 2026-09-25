/**
 * Purpose: Present an accessible switch with Motion-owned thumb movement.
 * Pattern: Radix control composition.
 * Usage: Used by scenario, settings, and round controls.
 * Related: src/ui/animation/use-reduced-motion-preference.ts, src/ui/animation/provider.tsx
 */
import * as React from "react"
import * as m from "motion/react-m"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/ui/lib/class-names"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { controlTransition } from "@/ui/animation/timing"

function Switch({
  className,
  size = "default",
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  const reducedMotion = useReducedMotionPreference()
  const [localChecked, setLocalChecked] = React.useState(defaultChecked ?? false)
  const active = checked ?? localChecked
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={value => { if (checked === undefined) setLocalChecked(value); onCheckedChange?.(value) }}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors duration-[var(--animation-feedback-duration)] outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb asChild><m.span data-slot="switch-thumb" initial={false}
        animate={{ x: active ? size === "sm" ? 10 : 14 : 0 }}
        transition={controlTransition(reducedMotion)}
        className="pointer-events-none block rounded-full bg-background ring-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground" />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
