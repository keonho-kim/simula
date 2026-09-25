/**
 * Purpose: Pair PDF.js selectable text with rendered pages and collect cited visual evidence.
 * Pattern: Bounded page-work adapter.
 * Usage: Called by document jobs for PDFs and Office documents converted to PDF.
 * Related: src/backend/runtime/documents.ts, src/backend/core/documents/source-numbers.ts
 */
import { pagePrompt } from "./prompts/page-interpretation"
import { readFile } from "node:fs/promises"
import { createCanvas } from "@napi-rs/canvas"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { DocumentError, parseExtraction } from "@/backend/core/documents/validation"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { unsupportedSourceNumbers } from "@/backend/core/documents/source-numbers"
import { MAX_IMAGE_BYTES, type ModelImage } from "@/backend/integrations/llm/vision-input"
import type { DocumentExtraction, EvidenceBlock } from "@/shared/documents"
import { MAX_EVIDENCE_BLOCKS } from "@/shared/documents-schema"
import { MAX_MODEL_CONCURRENCY } from "@/shared/settings"

const MAX_PDF_PAGES = 200
const MAX_PDF_BYTES = 64 * 1024 * 1024
const MAX_PROMPT_TEXT_CHARS = 12_000
const MAX_IMAGE_EDGE = 1_600

export type InterpretPage = (prompt: string, image: ModelImage, page: number) => Promise<string>

export async function interpretPdfPages(
  documentId: string, path: string, fastMode: boolean, concurrency: number,
  interpret: InterpretPage, signal?: AbortSignal, originalWorkbookText?: string,
): Promise<DocumentExtraction> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > MAX_MODEL_CONCURRENCY) {
    throw new Error(`Document concurrency must be between 1 and ${MAX_MODEL_CONCURRENCY}.`)
  }
  const input = await readFile(path)
  if (!input.length || input.length > MAX_PDF_BYTES) throw new DocumentError("document_too_large", "Split the PDF into smaller files.", 413)
  signal?.throwIfAborted()
  const loading = getDocument({ data: new Uint8Array(input), useSystemFonts: true, stopAtErrors: true })
  try {
    const pdf = await loading.promise
    if (!pdf.numPages || pdf.numPages > MAX_PDF_PAGES) throw new DocumentError("invalid_pdf_pages", `PDF must contain 1–${MAX_PDF_PAGES} pages.`, 422)
    const results: Array<{ blocks: EvidenceBlock[]; failed: boolean; issues: DocumentExtraction["issues"] }> = new Array(pdf.numPages)
    let cursor = 0
    const worker = async () => {
      while (cursor < pdf.numPages) {
        const index = cursor++
        const number = index + 1
        signal?.throwIfAborted()
        const page = await pdf.getPage(number)
        const textContent = originalWorkbookText === undefined ? await page.getTextContent() : undefined
        const text = originalWorkbookText ?? textContent?.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim() ?? ""
        const textBlocks = text && originalWorkbookText === undefined ? extractTextEvidence(documentId, new TextEncoder().encode(text)).blocks.map((block, part) => ({
          ...block, id: `${documentId}:page:${number}:text:${part + 1}`, method: "pdfjs" as const,
          locator: { kind: "page" as const, page: number, element: `#/pages/${number}/text` },
        })) : []
        try {
          const viewport = page.getViewport({ scale: 1 })
          const scale = Math.min(1.5, MAX_IMAGE_EDGE / Math.max(viewport.width, viewport.height))
          const sized = page.getViewport({ scale })
          const canvas = createCanvas(Math.ceil(sized.width), Math.ceil(sized.height))
          // PDF.js expects the browser context shape; the N-API canvas implements its rendering surface.
          await page.render({ canvas: canvas as unknown as HTMLCanvasElement,
            canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D, viewport: sized }).promise
          const bytes = await canvas.encode("png")
          if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Rendered page exceeds the image limit.")
          signal?.throwIfAborted()
          const summary = (await interpret(pagePrompt(documentId, number, text.slice(0, MAX_PROMPT_TEXT_CHARS), originalWorkbookText !== undefined), { mimeType: "image/png", bytes }, number)).trim()
          if (!summary) throw new Error("Visual interpretation is empty.")
          const acceptedSummary = text ? summary.split("\n").filter(line => !unsupportedSourceNumbers(line, text).length).join("\n").trim() : summary
          const unsupported = acceptedSummary !== summary
          const visualBlocks = !acceptedSummary ? [] : extractTextEvidence(documentId, new TextEncoder().encode(acceptedSummary)).blocks.map((block, part) => ({
            ...block, id: `${documentId}:page:${number}:visual:${part + 1}`, kind: "visual" as const,
            method: "vlm" as const, locator: { kind: "page" as const, page: number, element: `#/pages/${number}/image` },
          }))
          results[index] = { blocks: [...textBlocks, ...visualBlocks], failed: false, issues: [
            ...(unsupported ? [{ code: "visual_number_unverified", message: `Page ${number} visual summary used a number absent from authoritative extracted text; extracted text takes precedence.` }] : []),
            ...(text.length > MAX_PROMPT_TEXT_CHARS ? [{ code: "page_text_excerpt", message: `Page ${number} text exceeded the model prompt budget; full text remains in evidence.` }] : []),
          ] }
        } catch (error) {
          if (signal?.aborted || error instanceof DocumentError) throw error
          results[index] = { blocks: textBlocks, failed: true, issues: [{ code: "page_vision_failed", message: `Page ${number} could not be visually interpreted; selectable text remains available when present.` }] }
        } finally { page.cleanup() }
      }
    }
    await Promise.all(Array.from({ length: Math.min(pdf.numPages, fastMode ? concurrency : 1) }, worker))
    signal?.throwIfAborted()
    const blocks = results.flatMap(result => result.blocks)
    if (blocks.length > MAX_EVIDENCE_BLOCKS) throw new DocumentError("too_many_blocks", "Split the PDF into smaller files.", 413)
    if (!blocks.length && !originalWorkbookText?.trim()) {
      throw new DocumentError("no_document_evidence", "No PDF page could be interpreted; check the PDF and vision model.", 422)
    }
    const failed = results.filter(result => result.failed).length
    return parseExtraction({ blocks, coverage: { unit: "regions", totalUnits: pdf.numPages, processedUnits: pdf.numPages - failed,
      skippedUnits: 0, failedUnits: failed }, issues: results.flatMap(result => result.issues) }, documentId)
  } finally { await loading.destroy() }
}
