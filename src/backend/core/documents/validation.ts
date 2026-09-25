/**
 * Purpose: Parse document metadata and normalized extraction at upload/storage boundaries.
 * Pattern: Boundary parser.
 * Usage: Called by document persistence and API adapters.
 * Related: src/shared/documents.ts, src/backend/core/documents/text.ts
 */
import { z } from "zod"
import { DOCUMENT_FORMATS, type DocumentExtraction, type DocumentFormat, type DocumentSet } from "@/shared/documents"

import { extractionSchema, setSchema } from "@/shared/documents-schema"

export class DocumentError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) { super(message); this.name = "DocumentError" }
}

export function parseDocumentFormat(name: string): DocumentFormat {
  if (!name.trim() || name.length > 240 || /[\\/]/.test(name) || [...name].some(char => char.charCodeAt(0) < 32)) {
    throw new DocumentError("invalid_filename", "Provide a filename without paths or control characters.")
  }
  const extension = name.split(".").at(-1)?.toLowerCase()
  const result = z.enum(DOCUMENT_FORMATS).safeParse(extension)
  if (!result.success) throw new DocumentError("unsupported_format", "Unsupported document format.")
  return result.data
}

export function assertDocumentId(id: string): void {
  if (!z.uuid().safeParse(id).success) throw new DocumentError("invalid_identifier", "Invalid document identifier.")
}

export function parseDocumentSet(value: unknown): DocumentSet { return setSchema.parse(value) }

export function parseExtraction(value: unknown, documentId: string): DocumentExtraction {
  const result = extractionSchema.parse(value)
  if (result.blocks.some(block => block.documentId !== documentId)) throw new DocumentError("invalid_evidence", "Evidence belongs to another document.")
  if (new Set(result.blocks.map(block => block.id)).size !== result.blocks.length) throw new DocumentError("invalid_evidence", "Duplicate evidence identifiers.")
  return result
}
