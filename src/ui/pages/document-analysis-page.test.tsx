/**
 * Purpose: Verify document extraction is presented as a page with recovery controls, not a dialog.
 * Pattern: Server-rendered presentation contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/pages/document-analysis-page.tsx, src/ui/hooks/use-document-scenario.ts
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import { DocumentAnalysisPage } from "./document-analysis-page"

type Workflow = ReturnType<typeof useDocumentScenario>
function workflow(overrides: Partial<Workflow> = {}): Workflow {
  return { form: { context: "", situation: "auto", participants: [], fastMode: false }, setForm: () => {}, files: [],
    chooseFiles: async () => {}, removeFile: () => {}, execute: async () => {}, controlBuild: async () => {}, controlFile: async () => {}, reset: () => {},
    dirty: false, hydrated: true, saveLocalDraft: async () => {}, discardLocalDraft: async () => {}, busy: false, pendingGeneration: true,
    error: undefined, documents: { id: "set", revision: 1, createdAt: "now", documents: [
      { id: "document", name: "proposal.pdf", format: "pdf", sizeBytes: 10, sha256: "hash", createdAt: "now", status: "processing" },
    ] }, build: undefined, hasSession: true, refreshing: false, refresh: () => {}, ...overrides }
}
function render(w: Workflow) {
  return renderToStaticMarkup(<DocumentAnalysisPage workflow={w} language="ko" t={dictionary.ko} onHome={() => {}}
    onEdit={() => {}} onOpenSettings={() => {}} starting={false} autoContinue={false} onAutoContinueChange={() => {}}
    onStartWorld={() => {}} onOpenRun={() => {}} />)
}
test("document analysis uses a main page and exposes file reading state without setup fields", () => {
  const html = render(workflow())
  expect(html).toContain("문서 분석")
  expect(html).toContain("proposal.pdf")
  expect(html).toContain(dictionary.ko.builderCancelReading)
  expect(html).toContain("<main")
  expect(html).not.toContain('role="dialog"')
  expect(html).not.toContain("document-context")
})
test("failed extraction remains recoverable on the document page", () => {
  const w = workflow({ pendingGeneration: false, error: "extraction" })
  w.documents!.documents[0] = { ...w.documents!.documents[0]!, status: "failed", issue: { code: "failed", message: "failed" } }
  const html = render(w)
  expect(html).toContain(dictionary.ko.builderReadAgain)
  expect(html).toContain(dictionary.ko.builderReadFailedHelp)
  expect(html).not.toContain(dictionary.ko.builderConfirm)
  expect(html).not.toContain(dictionary.ko.documentAnalysisResume)
})


test("text-only analysis can resume when reloaded before the document set was created", () => {
  const w = workflow({ hasSession: false, documents: undefined, pendingGeneration: true,
    form: { context: "투자 회의", situation: "meeting", fastMode: false, participants: [] } })
  const html = render(w)
  expect(html).toContain(dictionary.ko.documentAnalysisResume)
})
