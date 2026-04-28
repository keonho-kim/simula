import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content?: string
  fallback?: string
  className?: string
  compact?: boolean
}

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", /^language-./, "math-inline", "math-display"],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", "math-inline", "math-display"],
    ],
  },
}

export function MarkdownContent({ content, fallback = "-", className, compact = false }: MarkdownContentProps) {
  const source = content?.trim() || fallback
  return (
    <div className={cn("simula-markdown", compact && "simula-markdown-compact", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeKatex]}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
