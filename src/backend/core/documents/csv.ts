/**
 * Purpose: Turn bounded CSV records into column-aware, source-linked evidence.
 * Pattern: Pure format transformation.
 * Usage: Called by document jobs for uploaded CSV files.
 * Related: src/backend/core/documents/text.ts, src/backend/runtime/documents.ts
 */
import Papa from "papaparse"
import type { DocumentExtraction, EvidenceBlock } from "@/shared/documents"
import { MAX_EVIDENCE_BLOCKS } from "@/shared/documents-schema"
import { decodeDocumentText, extractTextEvidence } from "./text"
import { DocumentError, parseExtraction } from "./validation"

const MAX_CSV_COLUMNS = 128
const MAX_CSV_RECORDS = 250_000
const MAX_CSV_FIELD_CHARS = 20_000
const SAMPLE_HEAD_ROWS = 40
const SAMPLE_TAIL_ROWS = 40
const NUMERIC = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/

interface CsvRow { index: number; values: string[] }
interface ColumnStats { missing: number; numeric: number; minimum: number; maximum: number }

export function extractCsvEvidence(documentId: string, bytes: Uint8Array): DocumentExtraction {
  const content = decodeDocumentText(bytes)
  let headers: string[] | undefined
  let statistics: ColumnStats[] = []
  let recordCount = 0
  let failure: DocumentError | undefined
  const first: CsvRow[] = []
  const last: CsvRow[] = []

  Papa.parse<string[]>(content, {
    delimiter: ",", skipEmptyLines: "greedy",
    step(result, parser) {
      if (result.errors.length) {
        failure = new DocumentError("invalid_csv", `CSV syntax error near record ${recordCount + 1}.`, 422)
        parser.abort()
        return
      }
      const values = result.data
      if (!headers) {
        const names = values.map(value => value.trim())
        if (!names.length || names.length > MAX_CSV_COLUMNS || names.some(name => !name || name.length > 240)
          || new Set(names.map(name => name.toLowerCase())).size !== names.length) {
          failure = new DocumentError("invalid_csv_header", "CSV header names must be distinct, non-empty, and within the column limit.", 422)
          parser.abort()
          return
        }
        headers = names
        statistics = names.map(() => ({ missing: 0, numeric: 0, minimum: Infinity, maximum: -Infinity }))
        return
      }
      if (values.length !== headers.length) {
        failure = new DocumentError("invalid_csv_columns", `CSV record ${recordCount + 2} has ${values.length} columns; expected ${headers.length}.`, 422)
        parser.abort()
        return
      }
      if (values.some(value => value.length > MAX_CSV_FIELD_CHARS) || ++recordCount > MAX_CSV_RECORDS) {
        failure = new DocumentError("csv_limit", "CSV record or field exceeds the extraction limit; split the file.", 413)
        parser.abort()
        return
      }
      for (const [index, value] of values.entries()) {
        const stats = statistics[index]!
        const trimmed = value.trim()
        if (!trimmed) { stats.missing++; continue }
        if (!NUMERIC.test(trimmed)) continue
        const numeric = Number(trimmed)
        if (!Number.isFinite(numeric)) continue
        stats.numeric++
        stats.minimum = Math.min(stats.minimum, numeric)
        stats.maximum = Math.max(stats.maximum, numeric)
      }
      const row = { index: recordCount + 1, values }
      if (first.length < SAMPLE_HEAD_ROWS) first.push(row)
      else {
        last.push(row)
        if (last.length > SAMPLE_TAIL_ROWS) last.shift()
      }
    },
  })
  if (failure) throw failure
  if (!headers || !recordCount) throw new DocumentError("empty_csv", "CSV needs a header and at least one data record.", 422)

  const blocks: EvidenceBlock[] = []
  const add = (text: string, element: string, startRow: number, endRow: number) => {
    const parts = extractTextEvidence(documentId, new TextEncoder().encode(text)).blocks
    for (const [part, block] of parts.entries()) {
      blocks.push({ ...block, id: `${documentId}:${element}:${part + 1}`, kind: "table", method: "native",
        locator: { kind: "table", element, startRow, endRow } })
      if (blocks.length > MAX_EVIDENCE_BLOCKS) throw new DocumentError("too_many_blocks", "Split the CSV into smaller files.", 413)
    }
  }
  const overview = [
    `CSV columns: ${headers.join(" | ")}`,
    `Data records: ${recordCount}`,
    ...headers.map((header, index) => {
      const stats = statistics[index]!
      const numeric = stats.numeric ? `; Numeric values: ${stats.numeric}; Minimum: ${stats.minimum}; Maximum: ${stats.maximum}` : ""
      return `${header}: Missing: ${stats.missing}${numeric}`
    }),
  ].join("\n")
  add(overview, "#/csv/summary", 1, recordCount + 1)
  for (const row of [...first, ...last]) {
    add(headers.map((header, index) => `${header}: ${row.values[index] || "[empty]"}`).join("\n"),
      `#/csv/records/${row.index}`, row.index, row.index)
  }
  return parseExtraction({ blocks, coverage: { unit: "regions", totalUnits: recordCount + 1,
    processedUnits: recordCount + 1, skippedUnits: 0, failedUnits: 0 }, issues: recordCount > first.length + last.length
    ? [{ code: "csv_rows_sampled", message: `All ${recordCount} CSV records were parsed; detailed evidence includes the first ${first.length} and last ${last.length} records plus column statistics.` }]
    : [] }, documentId)
}
