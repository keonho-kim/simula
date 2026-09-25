/**
 * Purpose: Decode text documents into bounded evidence without dropping source characters.
 * Pattern: Pure transformation.
 * Usage: Used by TXT/MD extraction and CSV decoding.
 * Related: src/shared/documents.ts, src/backend/core/documents/csv.ts
 */
import type { DocumentExtraction, EvidenceBlock } from "@/shared/documents"
import { DocumentError } from "./validation"
import { EVIDENCE_BLOCK_MAX_CHARS, MAX_DOCUMENT_BYTES, MAX_EVIDENCE_BLOCKS } from "@/shared/documents-schema"

export function extractTextEvidence(documentId: string, bytes: Uint8Array): DocumentExtraction {
  const content = decodeDocumentText(bytes)
  const blocks: EvidenceBlock[] = []
  let line = 1
  for (let start = 0; start < content.length;) {
    if (blocks.length >= MAX_EVIDENCE_BLOCKS) throw new DocumentError("too_many_blocks", "Split the document into smaller files.", 413)
    let end = Math.min(start + EVIDENCE_BLOCK_MAX_CHARS, content.length)
    if (end < content.length) {
      const newline = content.lastIndexOf("\n", end - 1)
      if (newline > start + EVIDENCE_BLOCK_MAX_CHARS / 2) end = newline + 1
      const code = content.charCodeAt(end - 1)
      if (code >= 0xd800 && code <= 0xdbff) end--
    }
    const text = content.slice(start, end)
    const newlines = text.match(/\n/g)?.length ?? 0
    blocks.push({
      id: `${documentId}:text:${blocks.length + 1}`, documentId, kind: "text", method: "native", content: text,
      locator: { kind: "text", startLine: line, endLine: line + newlines - (text.endsWith("\n") ? 1 : 0), startOffset: start, endOffset: end },
    })
    line += newlines
    start = end
  }
  return { blocks, coverage: { unit: "blocks", totalUnits: blocks.length, processedUnits: blocks.length, skippedUnits: 0, failedUnits: 0 }, issues: [] }
}

export function decodeDocumentText(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new DocumentError("document_too_large", "Document exceeds the byte limit.", 413)
  let content: string
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
    : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8"
  try { content = new TextDecoder(encoding, { fatal: true }).decode(bytes) }
  catch { throw new DocumentError("invalid_encoding", "Unsupported text encoding; save the document as UTF-8.") }
  if (!content.trim()) throw new DocumentError("empty_document", "The document is empty.")
  return content
}
