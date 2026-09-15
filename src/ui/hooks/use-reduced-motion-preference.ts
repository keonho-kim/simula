import { useSyncExternalStore } from "react"

const query = "(prefers-reduced-motion: reduce)"
const snapshot = () => window.matchMedia(query).matches
const serverSnapshot = () => true
function subscribe(notify: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}

/** Reactively apply preference changes without remounting the Motion layout tree. */
export function useReducedMotionPreference(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
