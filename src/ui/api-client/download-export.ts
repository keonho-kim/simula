/**
 * Purpose: Download run and analytical export text with one browser-owned object URL lifecycle.
 * Pattern: Browser download adapter.
 * Usage: Called by run and analytical export menu actions.
 * Related: src/ui/api-client/client.ts, src/ui/api-client/analytical-report.ts
 */
import { fetchExport } from "@/ui/api-client/client"

export async function downloadExport(runId: string, kind: "json" | "jsonl" | "md") {
  const body = await fetchExport(runId, kind)
  downloadText(body, `${runId}.${kind}`, "text/plain")
}

export function downloadText(body: string, filename: string, contentType: string): void {
  const blob = new Blob([body], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
