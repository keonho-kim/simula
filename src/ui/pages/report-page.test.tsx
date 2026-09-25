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
