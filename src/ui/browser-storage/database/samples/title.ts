/**
 * Purpose: Derive a sample scenario title from its Markdown heading.
 * Pattern: Pure Function.
 * Usage: Called by the sample read and list queries.
 * Related: src/ui/browser-storage/database/samples/read.ts, src/ui/browser-storage/database/samples/list.ts
 */
export function titleFromText(text: string, fallback: string): string {
  return text.split("\n").map(line => line.trim()).find(line => line.startsWith("# "))?.slice(2).trim() ?? fallback
}
