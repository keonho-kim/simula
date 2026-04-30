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

  test("renders bold actor labels", () => {
    const html = renderToStaticMarkup(<MarkdownContent content="**[A, B, C]**" />)

    expect(html).toContain("<strong>[A, B, C]</strong>")
  })

  test("separates a bold actor label from an attached list marker", () => {
    const html = renderToStaticMarkup(<MarkdownContent content="**[A, B, C]**- item" />)

    expect(html).toContain("<strong>[A, B, C]</strong>")
    expect(html).toContain("<ul>")
    expect(html).toContain("<li>item</li>")
  })

  test("allows sanitized markdown diff marks", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={'<mark data-markdown-diff="added">changed</mark>'} />
    )

    expect(html).toContain('data-markdown-diff="added"')
    expect(html).toContain("changed")
  })
})
