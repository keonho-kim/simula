/**
 * Purpose: Verify lossless bounded text evidence and upload format validation.
 * Pattern: Domain contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/documents/text.ts, src/backend/core/documents/validation.ts
 */
import { expect, test } from "bun:test"
import { extractTextEvidence } from "./text"
import { parseDocumentFormat } from "./validation"

test("long Korean text retains every character and stable source offsets", () => {
  const text = "# 회의 자료\r\n" + "한국어 자료와 🧑의 의견\n".repeat(450)
  const evidence = extractTextEvidence("document", new TextEncoder().encode(text))
  expect(evidence.blocks.length).toBeGreaterThan(1)
  expect(evidence.blocks.map(block => block.content).join("")).toBe(text)
  for (const block of evidence.blocks) {
    expect(block.content.length).toBeLessThanOrEqual(1800)
    expect(block.locator.kind).toBe("text")
    if (block.locator.kind !== "text") throw new Error("Expected text range")
    expect(text.slice(block.locator.startOffset, block.locator.endOffset)).toBe(block.content)
    expect(block.content).not.toContain("�")
  }
  expect(evidence.coverage.skippedUnits).toBe(0)
})

test("invalid encoding and empty text do not produce fabricated evidence", () => {
  expect(() => extractTextEvidence("document", new Uint8Array([0xff, 0xff, 0xff]))).toThrow("encoding")
  expect(() => extractTextEvidence("document", new TextEncoder().encode("   \n"))).toThrow("empty")
})

test("supported upload formats include every requested extension and reject path-like names", () => {
  for (const extension of ["pdf", "docx", "doc", "pptx", "xlsx", "csv", "txt", "md"] as const) {
    expect(parseDocumentFormat(`자료.${extension.toUpperCase()}`)).toBe(extension)
  }
  expect(() => parseDocumentFormat("../자료.txt")).toThrow("filename")
  expect(() => parseDocumentFormat("자료.exe")).toThrow("format")
})
