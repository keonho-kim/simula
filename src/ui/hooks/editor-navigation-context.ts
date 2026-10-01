/**
 * Purpose: Share the editor navigation guard contract without importing shell components.
 * Pattern: React context contract.
 * Usage: Provided by App and consumed by editor lifecycle hooks.
 * Related: src/ui/hooks/use-page-exit.ts, src/ui/shell/workspace-navigation.tsx
 */
import { createContext } from "react"
export type LeaveGuard = (continueNavigation: () => void) => void
export const NavigationGuardContext = createContext<((guard: LeaveGuard) => () => void) | null>(null)
