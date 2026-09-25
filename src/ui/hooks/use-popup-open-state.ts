/**
 * Purpose: Keep Radix popup roots controlled while exposing their open state to Motion presence.
 * Pattern: Controlled-state adapter.
 * Usage: Called by shared dialog, menu, select, and tooltip roots.
 * Related: src/ui/components/ui/dialog.tsx, src/ui/components/ui/dropdown-menu.tsx
 */
import { useState } from "react"

export function usePopupOpenState(controlled: boolean | undefined, initial: boolean | undefined,
  onChange: ((open: boolean) => void) | undefined): readonly [boolean, (open: boolean) => void] {
  const [local, setLocal] = useState(initial ?? false)
  return [controlled ?? local, next => {
    if (controlled === undefined) setLocal(next)
    onChange?.(next)
  }] as const
}
