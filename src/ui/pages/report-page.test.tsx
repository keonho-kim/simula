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
    expect(html.match(/role="tab"/g)).toHaveLength(4)
    expect(html).toContain("Relationships")
    expect(html).toContain("Conversations")
    expect(html).toContain("Performance")
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
