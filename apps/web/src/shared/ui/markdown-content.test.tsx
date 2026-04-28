import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownContent } from "./markdown-content"

describe("MarkdownContent", () => {
  test("renders markdown, sanitizes html, and renders math", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={"**bold** <script>alert(1)</script> $x^2$"} />
    )

    expect(html).toContain("<strong>bold</strong>")
    expect(html).not.toContain("<script")
    expect(html).toContain("katex")
  })
})
