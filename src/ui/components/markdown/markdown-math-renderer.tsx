/**
 * Purpose: Add KaTeX rendering only for Markdown content that contains math syntax.
 * Pattern: Lazy Feature Module.
 * Usage: Dynamically imported by MarkdownContent when paired dollar delimiters are present.
 * Related: src/ui/components/markdown/markdown-content.tsx, src/ui/components/markdown/markdown-renderer.tsx
 */
import rehypeKatex from "rehype-katex"
import remarkMath from "remark-math"
import { MarkdownRenderer } from "@/ui/components/markdown/markdown-renderer"
import "katex/dist/katex.min.css"

export function MarkdownMathRenderer({ source }: { source: string }) {
  return (
    <MarkdownRenderer
      source={source}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    />
  )
}
