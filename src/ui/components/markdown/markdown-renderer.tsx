/**
 * Purpose: Render sanitized Markdown with shared GFM and raw-HTML boundary rules.
 * Pattern: Presentation Adapter.
 * Usage: Used by the base and optional math Markdown components.
 * Related: src/ui/components/markdown/markdown-content.tsx, src/ui/components/markdown/markdown-math-renderer.tsx
 */
import ReactMarkdown, { type Options } from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import remarkGfm from "remark-gfm"

interface MarkdownRendererProps {
  source: string
  remarkPlugins?: Options["remarkPlugins"]
  rehypePlugins?: Options["rehypePlugins"]
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "mark"],
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
    mark: [
      ...(defaultSchema.attributes?.mark ?? []),
      ["data-markdown-diff", "added"],
      ["dataMarkdownDiff", "added"],
    ],
  },
}

export function MarkdownRenderer({ source, remarkPlugins, rehypePlugins }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, ...(remarkPlugins ?? [])]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], ...(rehypePlugins ?? [])]}
    >
      {source}
    </ReactMarkdown>
  )
}
