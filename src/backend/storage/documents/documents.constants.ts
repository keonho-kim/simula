/**
 * Purpose: Bound persisted document manifests, evidence and model-call artifacts.
 * Pattern: Shared resource limits.
 * Usage: Used by current-document storage and immutable source revisions.
 * Related: src/backend/storage/documents/document-store.ts, src/backend/storage/documents/source-revisions.ts
 */
export const MAX_MANIFEST_BYTES = 128 * 1024
export const MAX_EXTRACTION_BYTES = 64 * 1024 * 1024
export const MAX_DOCUMENT_METRICS_BYTES = 512 * 1024
