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
  inline?: boolean
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

const inlineComponents: Options["components"] = {
  p: ({ children }) => <>{children}</>,
  h1: ({ children }) => <>{children}</>,
  h2: ({ children }) => <>{children}</>,
  h3: ({ children }) => <>{children}</>,
  h4: ({ children }) => <>{children}</>,
  h5: ({ children }) => <>{children}</>,
  h6: ({ children }) => <>{children}</>,
  a: ({ children }) => <span>{children}</span>,
  ul: ({ children }) => <span>{children}</span>,
  ol: ({ children }) => <span>{children}</span>,
  li: ({ children }) => <span>{children}</span>,
  blockquote: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <span>{children}</span>,
}

export function MarkdownRenderer({ source, inline = false, remarkPlugins, rehypePlugins }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      components={inline ? inlineComponents : undefined}
      remarkPlugins={[remarkGfm, ...(remarkPlugins ?? [])]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], ...(rehypePlugins ?? [])]}
    >
      {source}
    </ReactMarkdown>
  )
}
