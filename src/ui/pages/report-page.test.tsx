/**
 * Purpose: Verify Report page navigation and always-visible metric composition.
 * Pattern: Server-rendered page contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/pages/report-page.tsx, src/ui/components/report/metric-overview.tsx
 */
import { describe, expect, mock, test } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"

mock.module("@/ui/components/simulation/simulation-stage", () => ({
  SimulationStage: () => <section>Mock Simulation Stage</section>,
}))

const { ReportPage } = await import("@/ui/pages/report-page")

describe("ReportPage", () => {
  test("renders top-level report tabs", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage
          t={dictionary.en}
          onHome={() => undefined}
          onExport={() => undefined}
        />
      </QueryClientProvider>
    )

    expect(html).toContain("Analysis Overview")
    expect(html.match(/role="tab"/g)).toHaveLength(3)
    expect(html).toContain("Relationships")
    expect(html).toContain("Conversations")
    expect(html).not.toContain(">Performance<")
    expect(html).toContain('aria-label="LLM metrics"')
    expect(html.indexOf('aria-label="LLM metrics"')).toBeLessThan(html.indexOf('role="tablist"'))
    expect(html.match(/0 samples/g)).toHaveLength(4)
    expect(html.match(/<article/g)).toHaveLength(4)
  })

  test("keeps the empty overview tab free of actor and stage panels", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage
          t={dictionary.en}
          onHome={() => undefined}
          onExport={() => undefined}
        />
      </QueryClientProvider>
    )

    expect(html).toContain("No commentary is stored")
    expect(html).not.toContain("Simulation Stage")
    expect(html).not.toContain("Search actors")
  })
})
