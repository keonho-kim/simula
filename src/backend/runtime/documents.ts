/**
 * Purpose: Own document extraction execution, cancellation, and persisted terminal status.
 * Pattern: Job lifecycle coordinator.
 * Usage: Composed by the backend entry point and invoked by document HTTP routes.
 * Related: src/backend/storage/documents/document-store.ts, src/backend/core/documents/csv.ts, src/backend/integrations/documents/pdf-vision.ts
 */
import { DocumentError, parseExtraction } from "@/backend/core/documents/validation"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { extractCsvEvidence } from "@/backend/core/documents/csv"
import { interpretPdfPages } from "@/backend/integrations/documents/pdf-vision"
import { withOfficePdf } from "@/backend/integrations/documents/office-pdf"
import { extractXlsxSourceEvidence } from "@/backend/integrations/documents/xlsx-source"
import { runWithModelExecution, type ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import { assertCompleteModelOutput, invokeRoleInputWithMetrics } from "@/backend/integrations/llm/invoke"
import { createVisionInput } from "@/backend/integrations/llm/vision-input"
import type { DocumentStore } from "@/backend/storage/documents/document-store"
import type { LLMSettings } from "@/shared/settings"
import type { DocumentExtraction, DocumentFormat } from "@/shared/documents"

interface ExtractionJob { controller: AbortController; completion: Promise<void> }
const PDF_VISION_OUTPUT_TOKENS = 2400

export class DocumentJobs {
  private readonly active = new Map<string, ExtractionJob>()
  private executing = 0
  private serialActive = false
  private readonly waiting = new Set<() => void>()

  constructor(private readonly store: DocumentStore, private readonly officeConverter: string,
    private readonly getSettings: () => Promise<LLMSettings>, private readonly admission: ModelCallAdmission) {}

  start(setId: string, documentId: string, fastMode = false): { completion: Promise<void>; alreadyRunning: boolean } {
    const key = `${setId}:${documentId}`
    const previous = this.active.get(key)
    if (previous) return { completion: previous.completion, alreadyRunning: true }
    const controller = new AbortController()
    const completion = this.extract(setId, documentId, fastMode, controller.signal).finally(() => this.active.delete(key))
    this.active.set(key, { controller, completion })
    return { completion, alreadyRunning: false }
  }

  cancel(setId: string, documentId: string): boolean {
    const job = this.active.get(`${setId}:${documentId}`)
    if (!job) return false
    job.controller.abort(new Error("Document extraction canceled."))
    return true
  }

  isActive(setId: string, documentId: string): boolean { return this.active.has(`${setId}:${documentId}`) }

  private async extract(setId: string, documentId: string, fastMode: boolean, signal: AbortSignal): Promise<void> {
    const document = await this.store.readDocument(setId, documentId)
    if (document.status === "ready") return
    let release: (() => void) | undefined
    try {
      const settings = await this.getSettings()
      release = await this.acquire(signal, fastMode, settings.concurrency)
      signal.throwIfAborted()
      await this.store.updateStatus(setId, documentId, "processing")
      const evidence = await this.extractEvidence(setId, documentId, document.format, fastMode, settings, signal)
      signal.throwIfAborted()
      await this.store.saveExtraction(setId, documentId, evidence)
    } catch (error) {
      if (signal.aborted) { await this.store.updateStatus(setId, documentId, "canceled"); return }
      const issue = error instanceof DocumentError
        ? { code: error.code, message: error.message }
        : { code: "extraction_failed", message: "Document extraction failed; check the document and retry." }
      await this.store.updateStatus(setId, documentId, "failed", issue)
    } finally { release?.() }
  }

  private async extractEvidence(setId: string, documentId: string, format: DocumentFormat, fastMode: boolean,
    settings: LLMSettings, signal: AbortSignal): Promise<DocumentExtraction> {
    if (format === "csv") return extractCsvEvidence(documentId, await this.store.readOriginal(setId, documentId))
    if (format === "txt" || format === "md") return extractTextEvidence(documentId, await this.store.readOriginal(setId, documentId))
    const path = await this.store.originalPath(setId, documentId)
    const sourceBlocks = format === "xlsx"
      ? await extractXlsxSourceEvidence(documentId, await this.store.readOriginal(setId, documentId), signal) : []
    const originalWorkbookText = sourceBlocks.map(block => block.locator.kind === "cell"
      ? `${block.locator.sheet} ${block.locator.address}: ${block.content}` : block.content).join("\n")
    const usageFailure = () => new DocumentError("usage_record_failed", "Document model-call usage could not be recorded; retry extraction.", 500)
    const analyzePdf = (pdfPath: string) => runWithModelExecution({ owner: documentId, admission: this.admission, signal,
      onModelCallFailure: failure => this.store.appendFailure(setId, documentId, failure).catch(() => { throw usageFailure() }) },
      () => interpretPdfPages(documentId, pdfPath, fastMode, settings.concurrency, async (prompt, image, page) => {
        const result = await invokeRoleInputWithMetrics(settings, "storyBuilder", "draft", 1,
          createVisionInput(prompt, image), undefined, { maxOutputTokens: PDF_VISION_OUTPUT_TOKENS, signal,
            taskId: `${documentId}:page:${page}` })
        await this.store.appendMetrics(setId, documentId, page, result.metrics).catch(() => { throw usageFailure() })
        assertCompleteModelOutput(result)
        return result.text
      }, signal, format === "xlsx" ? originalWorkbookText : undefined))
    if (format === "pdf") return analyzePdf(path)
    return withOfficePdf(path, this.officeConverter, signal, async pdfPath => {
      const extraction = await analyzePdf(pdfPath)
      if (format !== "xlsx") return extraction
      return parseExtraction({ ...extraction, blocks: [...sourceBlocks, ...extraction.blocks], coverage: { ...extraction.coverage,
        totalUnits: extraction.coverage.totalUnits + sourceBlocks.length, processedUnits: extraction.coverage.processedUnits + sourceBlocks.length } }, documentId)
    })
  }

  private acquire(signal: AbortSignal, fastMode: boolean, concurrency: number): Promise<() => void> {
    signal.throwIfAborted()
    const canEnter = () => !this.serialActive && (fastMode ? this.executing < concurrency : this.executing === 0)
    const release = () => {
      this.executing--
      if (!fastMode) this.serialActive = false
      for (const wake of [...this.waiting]) wake()
    }
    if (canEnter() && !this.waiting.size) { this.executing++; this.serialActive = !fastMode; return Promise.resolve(release) }
    return new Promise((resolve, reject) => {
      const cancel = () => {
        this.waiting.delete(admit)
        signal.removeEventListener("abort", cancel)
        reject(signal.reason)
        for (const wake of [...this.waiting]) wake()
      }
      const admit = () => {
        if (this.waiting.values().next().value !== admit || !canEnter()) return
        this.waiting.delete(admit)
        signal.removeEventListener("abort", cancel)
        this.executing++
        this.serialActive = !fastMode
        resolve(release)
      }
      this.waiting.add(admit)
      signal.addEventListener("abort", cancel, { once: true })
      if (signal.aborted) { cancel(); return }
      if (canEnter()) admit()
    })
  }
}
