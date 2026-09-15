import { useEffect } from "react"

/** Pause decorative CSS motion when the page is not visible. */
export function usePageVisibility(): void {
  useEffect(() => {
    const update = () => { document.documentElement.dataset.pageHidden = String(document.hidden) }
    update()
    document.addEventListener("visibilitychange", update)
    return () => {
      document.removeEventListener("visibilitychange", update)
      delete document.documentElement.dataset.pageHidden
    }
  }, [])
}
