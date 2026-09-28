/**
 * Purpose: Verify Report page navigation and always-visible metric composition.
 * Pattern: Server-rendered page contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/pages/report-page.tsx, src/ui/components/report/metric-overview.tsx
 */
import { describe, expect, test } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"

const { ReportPage } = await import("@/ui/pages/report-page")

describe("ReportPage", () => {
  test("a saved report displays results without generation controls or streams", () => {
    const client = new QueryClient()
    client.setQueryData(["analysis", "run", "saved-run"], { freshness: "current", analysis: {
      id: "saved-report", subject: { kind: "run", id: "saved-run" }, status: "ready", report: {
        perspective: { focus: "Review", objective: "Decide", horizon: "Now", boundary: "Budget", evidenceIds: [] },
        coverage: { requested: 1, completed: 1, failed: 0, canceled: 0, interrupted: 0, analyzed: 1 },
        trajectories: { categories: [], unclassifiedWorldIds: [] }, sections: [], evidenceIds: [], unavailableInputs: [],
      },
    } })
    const html = renderToStaticMarkup(<QueryClientProvider client={client}>
      <ReportPage selectedRunId="saved-run" language="en" t={dictionary.en} onHome={() => undefined} onExport={() => undefined} />
    </QueryClientProvider>)
    expect(html).toContain("Analysis board")
    expect(html).not.toContain("Preparing report")
    expect(html).not.toContain("Generate analysis")
    expect(html).not.toContain("report-task-output")
  })
  test("a missing report opens preparation rather than mixing generation with results", () => {
    const client = new QueryClient()
    client.setQueryData(["analysis", "run", "run-one"], { analysis: null, freshness: null })
    const html = renderToStaticMarkup(<QueryClientProvider client={client}>
      <ReportPage selectedRunId="run-one" language="en" t={dictionary.en} onHome={() => undefined} onExport={() => undefined} />
    </QueryClientProvider>)
    expect(html).toContain("Preparing report")
    expect(html).not.toContain("Recorded simulation")
    expect(html).not.toContain("Generate analysis")
    expect(html).toContain('aria-label="LLM metrics"')
  })
  test("renders permanent metrics and deferred record entry points without report tabs", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage
          language="en"
          t={dictionary.en}
          onHome={() => undefined}
          onExport={() => undefined}
        />
      </QueryClientProvider>
    )

    expect(html).toContain("Recorded simulation")
    expect(html).not.toContain('role="tab"')
    expect(html).toContain("Relationships")
    expect(html).toContain("Conversations")
    expect(html).not.toContain(">Performance<")
    expect(html).toContain('aria-label="LLM metrics"')
    expect(html.indexOf('aria-label="LLM metrics"')).toBeLessThan(html.indexOf('aria-label="Recorded simulation"'))
    expect(html.match(/0 samples/g)).toHaveLength(4)
    expect(html.match(/<article/g)).toHaveLength(4)
  })

  test("does not mount actor, replay, or simulation panels before a detail is opened", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage
          language="en"
          t={dictionary.en}
          onHome={() => undefined}
          onExport={() => undefined}
        />
      </QueryClientProvider>
    )

    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain("Replay timeline")
    expect(html).not.toContain("Simulation Stage")
    expect(html).not.toContain("Search actors")
  })
})
