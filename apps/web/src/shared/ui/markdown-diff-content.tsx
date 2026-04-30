import { cn } from "@/lib/utils"
import { MarkdownContent } from "./markdown-content"

interface MarkdownDiffContentProps {
  previous?: string
  current?: string
  fallback?: string
  className?: string
  compact?: boolean
}

export function MarkdownDiffContent({
  previous,
  current,
  fallback,
  className,
  compact = false,
}: MarkdownDiffContentProps) {
  const content = current?.trim()
  if (!previous?.trim() || !content) {
    return (
      <MarkdownContent
        compact={compact}
        content={current}
        fallback={fallback}
        className={className}
      />
    )
  }

  return (
    <MarkdownContent
      compact={compact}
      content={buildMarkdownDiff(previous, content)}
      fallback={fallback}
      className={cn("markdown-diff-content", className)}
    />
  )
}

export function buildMarkdownDiff(previous: string, current: string): string {
  const previousLines = previous.split("\n")
  const currentLines = current.split("\n")
  const matchedCurrentIndexes = longestCommonSubsequenceCurrentIndexes(previousLines, currentLines)
  let inFence = false

  return currentLines
    .map((line, index) => {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence
        return line
      }
      if (inFence || matchedCurrentIndexes.has(index) || !line.trim()) {
        return line
      }
      return highlightMarkdownLine(line)
    })
    .join("\n")
}

function longestCommonSubsequenceCurrentIndexes(
  previousLines: string[],
  currentLines: string[]
): Set<number> {
  const lengths = Array.from({ length: previousLines.length + 1 }, () =>
    Array<number>(currentLines.length + 1).fill(0)
  )

  for (let previousIndex = previousLines.length - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let currentIndex = currentLines.length - 1; currentIndex >= 0; currentIndex -= 1) {
      lengths[previousIndex][currentIndex] =
        previousLines[previousIndex] === currentLines[currentIndex]
          ? lengths[previousIndex + 1][currentIndex + 1] + 1
          : Math.max(lengths[previousIndex + 1][currentIndex], lengths[previousIndex][currentIndex + 1])
    }
  }

  const matchedCurrentIndexes = new Set<number>()
  let previousIndex = 0
  let currentIndex = 0
  while (previousIndex < previousLines.length && currentIndex < currentLines.length) {
    if (previousLines[previousIndex] === currentLines[currentIndex]) {
      matchedCurrentIndexes.add(currentIndex)
      previousIndex += 1
      currentIndex += 1
    } else if (lengths[previousIndex + 1][currentIndex] >= lengths[previousIndex][currentIndex + 1]) {
      previousIndex += 1
    } else {
      currentIndex += 1
    }
  }

  return matchedCurrentIndexes
}

function highlightMarkdownLine(line: string): string {
  const match = line.match(/^(\s*(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)?)(.*)$/)
  if (!match) {
    return `<mark data-markdown-diff="added">${escapeHtml(line)}</mark>`
  }
  const [, prefix, content] = match
  if (!content.trim()) {
    return line
  }
  return `${prefix}<mark data-markdown-diff="added">${escapeHtml(content)}</mark>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
