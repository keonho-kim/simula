/**
 * Purpose: Stop repeating Motion effects when the browser document is hidden.
 * Pattern: External browser-state subscription.
 * Usage: Read by visible simulation activity components.
 * Related: src/ui/hooks/use-page-visibility.ts, src/ui/components/simulation/scenario-board.tsx
 */
import { useSyncExternalStore } from "react"

function subscribe(notify: () => void): () => void {
  document.addEventListener("visibilitychange", notify)
  return () => document.removeEventListener("visibilitychange", notify)
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, () => !document.hidden, () => false)
}
