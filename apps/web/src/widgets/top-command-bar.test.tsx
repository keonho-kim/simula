import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/lib/i18n/dictionary"
import { TopCommandBar } from "./top-command-bar"

describe("TopCommandBar", () => {
  test("shows the report shortcut after a completed simulation", () => {
    const html = renderToStaticMarkup(
      <TopCommandBar
        selectedRunStatus="completed"
        showReportShortcut
        t={dictionary.en}
        onHome={() => {}}
        onReport={() => {}}
      />
    )

    expect(html).toContain("Report")
  })

  test("hides the report shortcut before completion", () => {
    const html = renderToStaticMarkup(
      <TopCommandBar
        selectedRunStatus="running"
        t={dictionary.en}
        onHome={() => {}}
      />
    )

    expect(html).not.toContain("Report")
  })
})
