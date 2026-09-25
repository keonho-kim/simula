/**
 * Purpose: Interpret one page image alongside authoritative extracted text.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/integrations/documents/pdf-vision.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"

export function pagePrompt(documentId: string, page: number, text: string, workbook: boolean): string {
  return `Interpret the PDF page identified in INFO. The SOURCE text and attached page image are provided together. ` +
    (workbook ? "The text is from the original workbook; the rendered image may contain recalculated spreadsheet values. Original cell values and missing caches are authoritative. "
      : "The text is selectable text from this PDF page and is authoritative where it disagrees with visual interpretation. ") +
    "Use the image to explain the page's meaning, charts, relationships, and content absent from text; do not attempt exhaustive OCR. " +
    "If there is no selectable text, read the image directly. Preserve material facts, names, dates, units, and decisions without inventing values. " +
    "Write concise labeled points in the source language. Do not repeat the document identifier or page number as a finding.\n" +
    renderPromptBlocks({ INFO: { documentId, page }, SOURCE: `${workbook ? "Original workbook cells" : "Selectable text"}:\n${text || (workbook ? "[No original workbook cell text]" : "[No selectable text on this page]")}` })
}
