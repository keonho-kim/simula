import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { buildMarkdownDiff, MarkdownDiffContent } from "./markdown-diff-content"

describe("MarkdownDiffContent", () => {
  test("marks added and changed current lines", () => {
    const html = renderToStaticMarkup(
      <MarkdownDiffContent
        previous={"# Draft\n\n- Old pressure\n- Shared line"}
        current={"# Draft\n\n- New pressure\n- Shared line\n- Added channel"}
      />
    )

    expect(html).toContain('data-markdown-diff="added"')
    expect(html).toContain("New pressure")
    expect(html).toContain("Added channel")
    expect(html).not.toContain("Old pressure")
  })

  test("renders current markdown without marks when previous content is missing", () => {
    const html = renderToStaticMarkup(
      <MarkdownDiffContent current={"# Draft\n\n**bold**"} />
    )

    expect(html).toContain("<strong>bold</strong>")
    expect(html).not.toContain("data-markdown-diff")
  })

  test("does not mark code fence contents", () => {
    const diff = buildMarkdownDiff(
      "Before\n\n```txt\nsame\n```",
      "Before\n\n```txt\nchanged\n```"
    )

    expect(diff).toContain("changed")
    expect(diff).not.toContain("<mark")
  })
})
