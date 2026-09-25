/**
 * Purpose: Preserve original XLSX cell values, formulas, and stored results as evidence.
 * Pattern: Bounded OOXML archive adapter.
 * Usage: Called beside PDF.js page extraction for XLSX uploads.
 * Related: src/backend/runtime/documents.ts, src/shared/documents-schema.ts
 */
import { posix } from "node:path"
import { unzip, type Unzipped } from "fflate"
import { XMLParser, XMLValidator } from "fast-xml-parser"
import { z } from "zod"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { DocumentError } from "@/backend/core/documents/validation"
import type { EvidenceBlock } from "@/shared/documents"
import { MAX_DOCUMENT_BYTES, MAX_EVIDENCE_BLOCKS } from "@/shared/documents-schema"

const MAX_XML_PART_BYTES = 4 * 1024 * 1024
const MAX_XML_TOTAL_BYTES = 32 * 1024 * 1024
const MAX_WORKSHEETS = 100
const MAX_FORMULA_CHARS = 8_000
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false,
  parseAttributeValue: false, trimValues: false,
  isArray: name => name === "sheet" || name === "Relationship" || name === "row" || name === "c" })
const workbookSchema = z.object({ workbook: z.object({ sheets: z.object({ sheet: z.array(z.object({
  "@_name": z.string().min(1).max(240), "@_r:id": z.string().min(1),
})).max(MAX_WORKSHEETS) }) }) })
const relationsSchema = z.object({ Relationships: z.object({ Relationship: z.array(z.object({
  "@_Id": z.string().min(1), "@_Target": z.string().min(1), "@_TargetMode": z.string().optional(),
})) }) })
const formulaSchema = z.union([z.string(), z.object({ "#text": z.string().optional(), "@_si": z.string().optional() })])
const cellSchema = z.object({ "@_r": z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/), "@_t": z.string().optional(),
  f: formulaSchema.optional(), v: z.string().optional(), is: z.unknown().optional() })
const worksheetSchema = z.object({ worksheet: z.object({ sheetData: z.object({ row: z.array(z.object({
  c: z.array(cellSchema).default([]),
})).default([]) }).optional() }) })

export async function extractXlsxFormulaEvidence(documentId: string, bytes: Uint8Array, signal?: AbortSignal): Promise<EvidenceBlock[]> {
  return extractWorkbookEvidence(documentId, bytes, false, signal)
}

export async function extractXlsxSourceEvidence(documentId: string, bytes: Uint8Array, signal?: AbortSignal): Promise<EvidenceBlock[]> {
  return extractWorkbookEvidence(documentId, bytes, true, signal)
}

async function extractWorkbookEvidence(documentId: string, bytes: Uint8Array, includeValues: boolean, signal?: AbortSignal): Promise<EvidenceBlock[]> {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new DocumentError("document_too_large", "XLSX exceeds the input byte limit.", 413)
  signal?.throwIfAborted()
  const files = await unzipWorkbook(bytes, signal)
  try { return parseCellBlocks(documentId, files, includeValues, signal) }
  catch (error) {
    if (error instanceof z.ZodError) throw new DocumentError("invalid_spreadsheet", "Workbook sheet or formula structure is invalid.", 422)
    throw error
  }
}

function parseCellBlocks(documentId: string, files: Unzipped, includeValues: boolean, signal?: AbortSignal): EvidenceBlock[] {
  const workbook = workbookSchema.parse(parseXml(files["xl/workbook.xml"]))
  const relations = relationsSchema.parse(parseXml(files["xl/_rels/workbook.xml.rels"]))
  const strings = includeValues ? sharedStrings(files["xl/sharedStrings.xml"]) : []
  const targets = new Map(relations.Relationships.Relationship.map(relation => [relation["@_Id"], relation]))
  const blocks: EvidenceBlock[] = []
  for (const [sheetIndex, sheet] of workbook.workbook.sheets.sheet.entries()) {
    signal?.throwIfAborted()
    const target = targets.get(sheet["@_r:id"])
    if (!target || target["@_TargetMode"] === "External") throw new DocumentError("invalid_worksheet", "Worksheet relationship is missing or external.")
    const path = worksheetPath(target["@_Target"])
    const content = worksheetSchema.parse(parseXml(files[path]))
    for (const row of content.worksheet.sheetData?.row ?? []) {
      for (const cell of row.c) {
        if (cell.f === undefined && !includeValues) continue
        let text: string
        if (cell.f !== undefined) {
          const expression = typeof cell.f === "string" ? cell.f : cell.f["#text"]
          const formula = expression ? `=${expression}` : `Shared formula reference ${typeof cell.f === "string" ? "unknown" : cell.f["@_si"] ?? "unknown"}; expression unavailable`
          if (formula.length > MAX_FORMULA_CHARS) throw new DocumentError("formula_too_large", "Split the workbook into smaller files.", 413)
          const cached = cell.v?.trim() ? `${cell.v} (stored, not recalculated)` : "unavailable (not recalculated)"
          text = `Formula: ${formula}\nCached result: ${cached}`
        } else {
          const value = cell["@_t"] === "s" ? strings[Number(cell.v)] : cell["@_t"] === "inlineStr" ? flattenText(cell.is) : cell.v
          if (!value?.trim()) continue
          text = `Value: ${value}`
        }
        const locator = { kind: "cell" as const, sheet: sheet["@_name"], address: cell["@_r"] }
        for (const [part, block] of extractTextEvidence(documentId, new TextEncoder().encode(text)).blocks.entries()) {
          blocks.push({ ...block, id: `${documentId}:xlsx:${sheetIndex + 1}:${cell["@_r"]}:${part + 1}`,
            kind: "table", method: "native", locator })
          if (blocks.length > MAX_EVIDENCE_BLOCKS) throw new DocumentError("too_many_blocks", "Split the workbook into smaller files.", 413)
        }
      }
    }
  }
  return blocks
}

function sharedStrings(bytes: Uint8Array | undefined): string[] {
  if (!bytes) return []
  const parsed = parseXml(bytes)
  const root = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>).sst : undefined
  if (typeof root !== "object" || root === null) return []
  const values = (root as Record<string, unknown>).si
  return (Array.isArray(values) ? values : values ? [values] : []).map(flattenText)
}

function flattenText(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(flattenText).join("")
  if (typeof value !== "object" || value === null) return ""
  return Object.entries(value).filter(([key]) => key === "t" || key === "r").map(([, child]) => flattenText(child)).join("")
}

function worksheetPath(target: string): string {
  const path = posix.normalize(target.startsWith("/") ? target.slice(1) : posix.join("xl", target))
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) throw new DocumentError("invalid_worksheet", "Worksheet path leaves the workbook scope.")
  return path
}

function parseXml(part: Uint8Array | undefined): unknown {
  if (!part) throw new DocumentError("invalid_spreadsheet", "A required workbook XML part is missing.")
  const text = new TextDecoder("utf-8", { fatal: true }).decode(part)
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(text) || XMLValidator.validate(text) !== true) {
    throw new DocumentError("invalid_spreadsheet", "Workbook XML is invalid or contains external entities.")
  }
  return xml.parse(text) as unknown
}

function unzipWorkbook(bytes: Uint8Array, signal?: AbortSignal): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    let total = 0
    let sheets = 0
    let exceeded = false
    let stop: () => void = () => {}
    const abort = () => { stop(); reject(signal?.reason) }
    stop = unzip(bytes, { filter: info => {
      const selected = info.name === "xl/workbook.xml" || info.name === "xl/_rels/workbook.xml.rels" || info.name === "xl/sharedStrings.xml"
        || /^xl\/worksheets\/[^/]+\.xml$/.test(info.name)
      if (!selected) return false
      if (info.name.startsWith("xl/worksheets/")) sheets++
      total += info.originalSize
      if (info.originalSize > MAX_XML_PART_BYTES || total > MAX_XML_TOTAL_BYTES || sheets > MAX_WORKSHEETS) exceeded = true
      return !exceeded
    } }, (error, files) => {
      signal?.removeEventListener("abort", abort)
      if (exceeded) { reject(new DocumentError("spreadsheet_archive_limit", "Workbook XML exceeds the extraction limit.", 413)); return }
      if (error) { reject(new DocumentError("invalid_spreadsheet", "Workbook archive could not be read.")); return }
      const expanded = Object.values(files).reduce((sum, value) => sum + value.byteLength, 0)
      if (expanded > MAX_XML_TOTAL_BYTES || Object.values(files).some(value => value.byteLength > MAX_XML_PART_BYTES)) {
        reject(new DocumentError("spreadsheet_archive_limit", "Workbook XML exceeds the extraction limit.", 413)); return
      }
      resolve(files)
    })
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) abort()
  })
}
