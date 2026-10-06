/**
 * Purpose: Verify batch-only analysis, unresolved scope gating, and inline result tabs.
 * Pattern: Server-rendered page contract tests with query snapshots.
 * Usage: Executed by bun test.
 * Related: src/ui/shell/report-flow.tsx, src/ui/pages/report-page.tsx
 */
import { expect, test } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { ReportFlow } from "@/ui/shell/report-flow"

function saved(client: QueryClient, kind: "run" | "batch", id: string, content: string) {
  client.setQueryData(["analysis", kind, id], { freshness: "current", analysis: {
    id: `report-${id}`, subject: { kind, id }, status: "ready", report: {
      perspective: { focus: "Review", objective: "Decide", horizon: "Now", boundary: "Budget", evidenceIds: [] },
      coverage: { requested: 1, completed: 1, failed: 0, canceled: 0, interrupted: 0, analyzed: 1 },
      trajectories: { categories: [], unclassifiedWorldIds: [] },
      sections: [{ id: "conclusion", status: "ready", summary: "Brief overview", content, findings: [], evidenceIds: [] }],
      evidenceIds: [], unavailableInputs: [],
    },
  } })
}
function render(client: QueryClient, id = "saved-run", mode: "report" | "report-preparation" = "report") {
  return renderToStaticMarkup(<QueryClientProvider client={client}>
    <ReportFlow mode={mode} onNavigate={() => undefined} selectedRunId={id} language="en" t={dictionary.en} onHome={() => undefined} onExport={() => undefined} />
  </QueryClientProvider>)
}
function manifest(client: QueryClient, batchId?: string) {
  client.setQueryData(["runs", "saved-run"], { run: { id: "saved-run", status: "completed", batchId }, events: [], timeline: [] })
}
test("a saved standalone report exposes full conclusion and deferred record tabs, with deferred execution metrics", () => {
  const client = new QueryClient()
  manifest(client)
  saved(client, "run", "saved-run", "Detailed judgment.\n\nEvidence explains the outcome.\n\nNext checks remain explicit.")
  const html = render(client)
  expect(html).toContain("Detailed judgment.")
  expect(html).toContain("Next checks remain explicit.")
  expect(html).toContain('role="tab"')
  expect(html).toContain("Records")
  expect(html).toContain("Execution details")
  expect(html).toContain('class="workspace-toolbar"')
  expect(html).toContain('data-appearance="editorial"')
  expect(html).toContain(">Home</button>")
  expect(html).not.toContain('aria-label="LLM metrics"')
  expect(html).not.toContain('aria-haspopup="dialog"')
  expect(html).not.toContain("Preparing report")
  expect(html).not.toContain("report-task-output")
  expect(html).not.toContain("Replay timeline")
})
test("unresolved ownership never shows a cached standalone report", () => {
  const client = new QueryClient()
  saved(client, "run", "saved-run", "Wrong scope")
  expect(render(client)).not.toContain("Wrong scope")
  expect(render(client)).toContain('role="status"')
})
test("a world opens only its parent analysis, without per-world result panels or scope switches", () => {
  const client = new QueryClient()
  manifest(client, "batch")
  saved(client, "run", "saved-run", "Individual world conclusion")
  saved(client, "batch", "batch", "Combined conclusion")
  client.setQueryData(["multiverse", "batch"], { id: "batch", status: "completed", worlds: [{ status: "completed" }] })
  const html = render(client)
  expect(html).toContain("Combined conclusion")
  expect(html).not.toContain("Individual world conclusion")
  expect(html).not.toContain("Analyze this world")
  expect(html).not.toContain("Analyze this Multiverse")
  expect(html).not.toContain("Relationships")
  expect(html).not.toContain("Conversations")
})
test("an active batch shows a waiting state instead of generating a partial-world analysis", () => {
  const client = new QueryClient()
  manifest(client, "batch")
  saved(client, "run", "saved-run", "Individual world conclusion")
  client.setQueryData(["multiverse", "batch"], { id: "batch", status: "running", worlds: [{ status: "waiting" }] })
  const html = render(client, "saved-run", "report-preparation")
  expect(html).toContain(dictionary.en.analysisBatchWaiting)
  expect(html).not.toContain("Individual world conclusion")
  expect(html).not.toContain("Evidence review")
})
test("missing analysis shows simulation-style metrics above preparation without a disclosure", () => {
  const client = new QueryClient()
  manifest(client)
  client.setQueryData(["analysis", "run", "saved-run"], { analysis: null, freshness: null })
  const html = render(client, "saved-run", "report-preparation")
  expect(html).toContain("Preparing report")
  expect(html).toContain("Evidence review")
  expect(html).toContain('aria-label="LLM metrics"')
  expect(html).toContain("llm-metrics-grid")
  expect(html.indexOf('aria-label="LLM metrics"')).toBeLessThan(html.indexOf("report-preparation-columns"))
  expect(html).not.toContain("<details")
  expect(html).not.toContain('role="tablist"')
})
