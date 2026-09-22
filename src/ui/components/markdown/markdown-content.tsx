/**
 * Purpose: Render sanitized Markdown and defer optional math support until content needs it.
 * Pattern: Conditional Lazy Component.
 * Usage: Imported by report, scenario, and actor presentation components.
 * Related: src/ui/components/markdown/markdown-renderer.tsx, src/ui/components/markdown/markdown-math-renderer.tsx
 */
import { lazy, Suspense } from "react"
import { cn } from "@/ui/lib/class-names"
import { MarkdownRenderer } from "@/ui/components/markdown/markdown-renderer"
import "@/ui/styles/markdown.css"

interface MarkdownContentProps {
  content?: string
  fallback?: string
  className?: string
  compact?: boolean
}

const MarkdownMathRenderer = lazy(() =>
  import("@/ui/components/markdown/markdown-math-renderer").then((module) => ({
    default: module.MarkdownMathRenderer,
  }))
)

export function MarkdownContent({ content, fallback = "-", className, compact = false }: MarkdownContentProps) {
  const source = normalizeMarkdownSource(content?.trim() || fallback)
  return (
    <div className={cn("simula-markdown", compact && "simula-markdown-compact", className)}>
      {hasMathSyntax(source) ? (
        <Suspense fallback={<MarkdownRenderer source={source} />}>
          <MarkdownMathRenderer source={source} />
        </Suspense>
      ) : (
        <MarkdownRenderer source={source} />
      )}
    </div>
  )
}

export function hasMathSyntax(source: string): boolean {
  const openDelimiters = new Set<number>()
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "$" || isEscaped(source, index)) continue
    const length = source[index + 1] === "$" ? 2 : 1
    if (openDelimiters.has(length)) return true
    openDelimiters.add(length)
    index += length - 1
  }
  return false
}

export function normalizeMarkdownSource(source: string): string {
  const lines = source.split("\n")
  let inFence = false
  return lines
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence
        return line
      }
      if (inFence) {
        return line
      }
      return line.replace(/(\*\*\[[^\]\n]+\]\*\*)(?=(?:[-*+]\s+|\d+[.)]\s+))/g, "$1\n")
    })
    .join("\n")
}

function isEscaped(source: string, index: number): boolean {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}
