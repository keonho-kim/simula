/**
 * Purpose: Define portable uploaded-document and source-evidence contracts.
 * Pattern: Shared contracts.
 * Usage: Consumed by document API, storage, extraction, and scenario construction.
 * Related: src/backend/core/documents/validation.ts, src/backend/storage/documents/document-store.ts
 */
export const DOCUMENT_FORMATS = ["pdf", "docx", "doc", "pptx", "xlsx", "csv", "txt", "md"] as const
export type DocumentFormat = typeof DOCUMENT_FORMATS[number]
export const EVIDENCE_METHODS = ["native", "pdfjs", "libreoffice", "vlm"] as const

export type SourceLocator =
  | { kind: "text"; startLine: number; endLine: number; startOffset: number; endOffset: number }
  | { kind: "page"; page: number; element: string }
  | { kind: "element"; element: string }
  | { kind: "table"; element: string; startRow: number; endRow: number; sheet?: string }
  | { kind: "cell"; sheet: string; address: string }

export interface EvidenceBlock {
  id: string
  documentId: string
  kind: "text" | "table" | "visual"
  method: typeof EVIDENCE_METHODS[number]
  content: string
  locator: SourceLocator
}

export interface DocumentIssue {
  code: string
  message: string
}

export interface ExtractionCoverage {
  unit: "blocks" | "regions"
  totalUnits: number
  processedUnits: number
  skippedUnits: number
  failedUnits: number
}

export interface DocumentExtraction {
  blocks: EvidenceBlock[]
  coverage: ExtractionCoverage
  issues: DocumentIssue[]
}

interface DocumentMetadata {
  id: string
  name: string
  format: DocumentFormat
  sizeBytes: number
  sha256: string
  createdAt: string
}

export type DocumentRecord = DocumentMetadata & (
  | { status: "uploaded" | "processing" | "canceled" }
  | { status: "ready" | "partial"; blockCount: number; coverage: ExtractionCoverage; issue?: DocumentIssue }
  | { status: "failed"; issue: DocumentIssue }
)

export interface DocumentSet {
  id: string
  revision: number
  createdAt: string
  documents: DocumentRecord[]
}
