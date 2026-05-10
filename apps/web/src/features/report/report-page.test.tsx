import { describe, expect, mock, test } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/lib/i18n/dictionary"

mock.module("@/widgets/simulation-stage", () => ({
  SimulationStage: () => <section>Mock Simulation Stage</section>,
}))

const { ReportPage } = await import("./report-page")

describe("ReportPage", () => {
  test("renders top-level analysis and actors-stage tabs", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage
          t={dictionary.en}
          onHome={() => undefined}
          onExport={() => undefined}
        />
      </QueryClientProvider>
    )

    expect(html).toContain("Analysis Dashboard")
    expect(html).toContain("Actors + Stage")
  })

  test("keeps the default analysis tab free of actor and stage panels", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ReportPage
          t={dictionary.en}
          onHome={() => undefined}
          onExport={() => undefined}
        />
      </QueryClientProvider>
    )

    expect(html).toContain("Select or complete a run")
    expect(html).not.toContain("Simulation Stage")
    expect(html).not.toContain("Search actors")
  })
})
