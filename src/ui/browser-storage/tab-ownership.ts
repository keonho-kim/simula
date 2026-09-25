/**
 * Purpose: Reserve the browser database for one tab and notify its owner on return requests.
 * Pattern: Browser lifecycle lease.
 * Usage: Acquired before React mounts in src/ui/shell/client-root.tsx.
 * Related: src/ui/pages/blocked-tab.tsx, src/ui/browser-storage/database/connection.ts
 */
const LOCK_NAME = "simula-primary-tab"
const CHANNEL_NAME = "simula-tab-focus"
export type TabOwnership = "owner" | "blocked" | "unsupported"

export async function claimPrimaryTab(): Promise<TabOwnership> {
  if (!navigator.locks || !navigator.storage?.getDirectory || !globalThis.BroadcastChannel) return "unsupported"
  return new Promise<TabOwnership>(resolve => {
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true, mode: "exclusive" }, async lock => {
      if (!lock) { resolve("blocked"); return }
      const channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = event => { if (event.data === "focus") window.focus() }
      resolve("owner")
      try { await new Promise<void>(() => undefined) }
      finally { channel.close() }
    }).catch(() => resolve("unsupported"))
  })
}

export function requestOwnerFocus(): void {
  const request = new BroadcastChannel(CHANNEL_NAME)
  request.postMessage("focus")
  request.close()
}
