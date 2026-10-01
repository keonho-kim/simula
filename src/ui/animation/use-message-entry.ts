/**
 * Purpose: Animate newly received visible cards once without replaying entry during virtualization.
 * Pattern: Lifecycle-owned bounded Web Animation.
 * Usage: LiveActorHistory calls the returned callback for mounted message surfaces.
 * Related: src/ui/components/actors/history/live-history.tsx
 */
import { useCallback, useEffect, useRef } from "react"
const MESSAGE_ENTRY_MS = 120
export function useMessageEntry() {
  const seen = useRef(new WeakSet<object>())
  const animations = useRef(new Set<Animation>())
  useEffect(() => {
    const active = animations.current
    const cancel = () => { for (const animation of active) animation.cancel(); active.clear() }
    const visibility = () => { if (document.hidden) cancel() }
    document.addEventListener("visibilitychange", visibility)
    return () => { cancel(); document.removeEventListener("visibilitychange", visibility) }
  }, [])
  return useCallback((node: HTMLDivElement | null, message: object, fresh: boolean) => {
    if (!node || seen.current.has(message)) return
    seen.current.add(message)
    if (!fresh || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const animation = node.animate([{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: MESSAGE_ENTRY_MS, easing: "ease-out" })
    animations.current.add(animation)
    animation.onfinish = () => animations.current.delete(animation)
  }, [])
}
