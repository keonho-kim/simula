/**
 * Purpose: Coordinate explicit analytical generation and read-only persisted report discovery.
 * Pattern: Query lifecycle hook with idempotent creation.
 * Usage: Owned by a report workspace keyed by run or batch subject.
 * Related: src/ui/api-client/analytical-report.ts
 */
import { useRef } from "react"
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AnalysisSubject } from "@/shared/analytical-report"
import { controlAnalysis, createAnalysis, lookupAnalysis } from "@/ui/api-client/analytical-report"

const REPORT_POLL_MS = 1000
export function useAnalyticalReport(subject: AnalysisSubject) {
  const client = useQueryClient()
  const pendingId = useRef<string | undefined>(undefined)
  const key = ["analysis", subject.kind, subject.id]
  const mutationKey = ["analysis-command", subject.kind, subject.id]
  const commandPending = useIsMutating({ mutationKey }) > 0
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => lookupAnalysis(subject, signal), retry: false,
    enabled: Boolean(subject.id),
    refetchInterval: query => query.state.data?.analysis?.status === "running" ? REPORT_POLL_MS : false,
  })
  const record = query.data?.analysis
  const running = record?.status === "running"
  const command = useMutation({ mutationKey, mutationFn: async (action: "generate" | "cancel") => {
    if (action === "cancel" && record) { await controlAnalysis(record.id, "cancel"); return }
    if (record && query.data?.freshness === "current" && record.status !== "ready") await controlAnalysis(record.id, "retry")
    else {
      pendingId.current ??= crypto.randomUUID()
      const created = await createAnalysis(subject, pendingId.current)
      pendingId.current = undefined
      client.setQueryData(key, { analysis: created, freshness: "current" })
    }
  }, onSuccess: () => client.invalidateQueries({ queryKey: key }) })
  return { query, record, running, command, commandPending }
}
