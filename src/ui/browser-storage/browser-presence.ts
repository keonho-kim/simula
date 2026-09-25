/**
 * Purpose: Keep a browser-owned socket open so server work expires after the tab disconnects.
 * Pattern: Browser lifecycle subscription.
 * Usage: Started after SQLite opens in the browser composition root.
 * Related: src/backend/runtime/browser-sessions.ts, src/ui/shell/client-root.tsx
 */
export function startBrowserPresence(onSessionReplaced: () => void): void {
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let suspended = false
  const connect = () => {
    if (suspended) return
    const scheme = location.protocol === "https:" ? "wss:" : "ws:"
    socket = new WebSocket(`${scheme}//${location.host}/api/browser-session/socket`)
    socket.onmessage = event => { if (event.data === "replaced") onSessionReplaced() }
    socket.onclose = () => { if (!suspended) retry = setTimeout(connect, 1_000) }
  }
  window.addEventListener("pagehide", () => {
    suspended = true
    clearTimeout(retry)
    socket?.close()
  })
  window.addEventListener("pageshow", event => {
    if (event.persisted && suspended) { suspended = false; connect() }
  })
  connect()
}
