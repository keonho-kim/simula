/**
 * Purpose: Own Radix menu open state and Motion presence for menu surfaces.
 * Pattern: Controlled popup presence.
 * Usage: Re-exported by src/ui/components/ui/dropdown-menu.tsx.
 * Related: src/ui/hooks/use-popup-open-state.ts, src/ui/components/ui/dropdown-menu.tsx
 */
import * as React from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { DropdownMenu as Primitive } from "radix-ui"
import { cn } from "@/ui/lib/class-names"
import { usePopupOpenState } from "@/ui/hooks/use-popup-open-state"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"

const MenuOpenContext = React.createContext(false)
const SubOpenContext = React.createContext(false)
const MotionMenuContent = m.create(Primitive.Content)
const MotionSubContent = m.create(Primitive.SubContent)
type MenuContentProps = Pick<React.ComponentProps<typeof Primitive.Content>,
  "className" | "children" | "align" | "sideOffset" | "onCloseAutoFocus" | "onEscapeKeyDown" |
  "onPointerDownOutside" | "onInteractOutside">

export function DropdownMenu({ open: controlledOpen, defaultOpen, onOpenChange, ...props }:
  React.ComponentProps<typeof Primitive.Root>) {
  const [open, changeOpen] = usePopupOpenState(controlledOpen, defaultOpen, onOpenChange)
  return <MenuOpenContext.Provider value={open}>
    <Primitive.Root data-slot="dropdown-menu" open={open} onOpenChange={changeOpen} {...props} />
  </MenuOpenContext.Provider>
}

export function DropdownMenuPortal(props: React.ComponentProps<typeof Primitive.Portal>) {
  return <Primitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

export function DropdownMenuContent({ className, align = "start", sideOffset = 4, ...props }: MenuContentProps) {
  const open = React.useContext(MenuOpenContext)
  const reducedMotion = useReducedMotionPreference()
  return <Primitive.Portal forceMount>
    <AnimatePresence>{open ? <MotionMenuContent key="menu" forceMount data-slot="dropdown-menu-content"
      sideOffset={sideOffset} align={align}
      {...slidePresence(reducedMotion, "y", -4, -4, "popup")}
      className={cn("z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10", className)}
      {...props} /> : null}</AnimatePresence>
  </Primitive.Portal>
}

export function DropdownMenuSub({ open: controlledOpen, defaultOpen, onOpenChange, ...props }:
  React.ComponentProps<typeof Primitive.Sub>) {
  const [open, changeOpen] = usePopupOpenState(controlledOpen, defaultOpen, onOpenChange)
  return <SubOpenContext.Provider value={open}>
    <Primitive.Sub data-slot="dropdown-menu-sub" open={open} onOpenChange={changeOpen} {...props} />
  </SubOpenContext.Provider>
}

export function DropdownMenuSubContent({ className, ...props }:
  Pick<React.ComponentProps<typeof Primitive.SubContent>, "className" | "children">) {
  const open = React.useContext(SubOpenContext)
  const reducedMotion = useReducedMotionPreference()
  return <AnimatePresence>{open ? <MotionSubContent key="submenu" forceMount data-slot="dropdown-menu-sub-content"
    {...slidePresence(reducedMotion, "x", -4, -4, "feedback")}
    className={cn("z-50 min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10", className)}
    {...props} /> : null}</AnimatePresence>
}
