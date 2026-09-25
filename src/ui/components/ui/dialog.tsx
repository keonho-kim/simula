/**
 * Purpose: Compose accessible Radix dialogs with Motion-owned entrance and exit.
 * Pattern: Controlled presence boundary.
 * Usage: Shared by settings, scenario, simulation, and report dialogs.
 * Related: src/ui/animation/provider.tsx, src/ui/animation/use-reduced-motion-preference.ts
 */
"use client"

import * as React from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/ui/lib/class-names"
import { Button } from "@/ui/components/ui/button"
import { XIcon } from "lucide-react"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { usePopupOpenState } from "@/ui/hooks/use-popup-open-state"
import { fadePresence } from "@/ui/animation/presence"

const DialogOpenContext = React.createContext(false)
const MotionOverlay = m.create(DialogPrimitive.Overlay)
const MotionContent = m.create(DialogPrimitive.Content)
type DialogContentProps = Pick<React.ComponentProps<typeof DialogPrimitive.Content>,
  "className" | "children" | "aria-describedby" | "onEscapeKeyDown" | "onInteractOutside" |
  "onPointerDownOutside" | "onFocusOutside" | "onOpenAutoFocus" | "onCloseAutoFocus"> & { showCloseButton?: boolean }

function Dialog({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [open, changeOpen] = usePopupOpenState(controlledOpen, defaultOpen, onOpenChange)
  return <DialogOpenContext.Provider value={open}>
    <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={changeOpen} {...props} />
  </DialogOpenContext.Provider>
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  const open = React.useContext(DialogOpenContext)
  const reducedMotion = useReducedMotionPreference()
  return (
    <DialogPortal forceMount>
      <AnimatePresence>{open ? [
      <MotionOverlay key="overlay" forceMount data-slot="dialog-overlay"
        {...fadePresence(reducedMotion, "popup")}
        className="fixed inset-0 isolate z-50 bg-black/10" />,
      <MotionContent key="content" forceMount
        data-slot="dialog-content"
        {...fadePresence(reducedMotion, "popup")}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </MotionContent>,
      ] : null}</AnimatePresence>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
