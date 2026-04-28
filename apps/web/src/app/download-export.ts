import { fetchExport } from "@/lib/api"

export async function downloadExport(runId: string, kind: "json" | "jsonl" | "md") {
  const body = await fetchExport(runId, kind)
  const blob = new Blob([body], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${runId}.${kind}`
  anchor.click()
  URL.revokeObjectURL(url)
}
