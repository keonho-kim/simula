/**
 * Purpose: Compose accessible tooltips with Motion-owned popup transitions.
 * Pattern: Controlled popup presence.
 * Usage: Used by report explanations and settings help.
 * Related: src/ui/hooks/use-popup-open-state.ts, src/ui/animation/provider.tsx
 */
"use client"

import * as React from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/ui/lib/class-names"
import { usePopupOpenState } from "@/ui/hooks/use-popup-open-state"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"

const TooltipOpenContext = React.createContext(false)
const MotionTooltipContent = m.create(TooltipPrimitive.Content)
type TooltipContentProps = Pick<React.ComponentProps<typeof TooltipPrimitive.Content>,
  "className" | "children" | "sideOffset" | "side" | "align">

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [open, changeOpen] = usePopupOpenState(controlledOpen, defaultOpen, onOpenChange)
  return <TooltipOpenContext.Provider value={open}>
    <TooltipPrimitive.Root data-slot="tooltip" open={open} onOpenChange={changeOpen} {...props} />
  </TooltipOpenContext.Provider>
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: TooltipContentProps) {
  const open = React.useContext(TooltipOpenContext)
  const reducedMotion = useReducedMotionPreference()
  return (
    <TooltipPrimitive.Portal forceMount>
      <AnimatePresence>{open ? <MotionTooltipContent key="tooltip" forceMount
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...slidePresence(reducedMotion, "y", 3, 3, "feedback")}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </MotionTooltipContent> : null}</AnimatePresence>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
