/**
 * Purpose: Verify sanitized Markdown rendering and conditional math module selection.
 * Pattern: Server-rendered component contract test.
 * Usage: Run with `bun test src/ui/components/markdown/markdown-content.test.tsx`.
 * Related: src/ui/components/markdown/markdown-content.tsx, src/ui/components/markdown/markdown-math-renderer.tsx
 */
import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { hasMathSyntax, MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { MarkdownMathRenderer } from "@/ui/components/markdown/markdown-math-renderer"

describe("MarkdownContent", () => {
  test("renders markdown and sanitizes html", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent content={"**bold** <script>alert(1)</script>"} />
    )

    expect(html).toContain("<strong>bold</strong>")
    expect(html).not.toContain("<script")
  })

  test("detects math content and renders it through the deferred math renderer", () => {
    expect(hasMathSyntax("value: $x^2$")).toBe(true)
    expect(hasMathSyntax("price: $100")).toBe(false)
    expect(hasMathSyntax(String.raw`escaped: \$x\$`)).toBe(false)

    const html = renderToStaticMarkup(<MarkdownMathRenderer source="$x^2$" />)
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
