/**
 * Purpose: Compose accessible Radix tabs with Motion-owned selection and content entry.
 * Pattern: Controlled tab composition.
 * Usage: Used by settings, actor details, and sample selection.
 * Related: src/ui/animation/provider.tsx, src/ui/animation/use-reduced-motion-preference.ts
 */
import * as React from "react"
import * as m from "motion/react-m"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/ui/lib/class-names"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { tabPressMotion } from "@/ui/animation/interaction"
import { slidePresence } from "@/ui/animation/presence"
import { motionTransition } from "@/ui/animation/timing"

const TabsValueContext = React.createContext<string | undefined>(undefined)
const TabsVariantContext = React.createContext<"default" | "line">("default")

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [localValue, setLocalValue] = React.useState(defaultValue)
  return (
    <TabsValueContext.Provider value={value ?? localValue}>
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      value={value}
      defaultValue={defaultValue}
      onValueChange={next => { setLocalValue(next); onValueChange?.(next) }}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
    </TabsValueContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsVariantContext.Provider value={variant ?? "default"}>
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
    </TabsVariantContext.Provider>
  )
}

function TabsTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const selected = React.useContext(TabsValueContext) === props.value
  const variant = React.useContext(TabsVariantContext)
  const reducedMotion = useReducedMotionPreference()
  return (
    <TabsPrimitive.Trigger asChild
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors duration-[var(--animation-feedback-duration)] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        className
      )}
      {...props}
    >
      <m.button type="button" initial={false} {...tabPressMotion(reducedMotion)}>
        {children}
        {variant === "line" ? <m.span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-[5px] h-0.5 bg-foreground"
          initial={false} animate={{ opacity: selected ? 1 : 0 }} transition={motionTransition(reducedMotion, "feedback")} /> : null}
      </m.button>
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const reducedMotion = useReducedMotionPreference()
  return (
    <TabsPrimitive.Content asChild
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    ><m.div {...slidePresence(reducedMotion, "y", 4, 0, "quick")}>{children}</m.div>
    </TabsPrimitive.Content>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
