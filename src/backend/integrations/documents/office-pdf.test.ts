/**
 * Purpose: Verify Office conversion keeps its Node process and error contract.
 * Pattern: Adapter contract test.
 * Usage: Run by bun test src/backend/integrations/documents/office-pdf.test.ts.
 * Related: src/backend/integrations/documents/office-pdf.ts
 */
import { test, expect } from "bun:test"
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { withOfficePdf } from "./office-pdf"

test("reports a missing converter as an actionable document error", async () => {
  await expect(withOfficePdf("missing.docx", "simula-no-such-converter", new AbortController().signal,
    async () => "unused")).rejects.toMatchObject({ code: "converter_unavailable", status: 503 })
})

test("passes the converted PDF to the consumer", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-office-test-"))
  try {
    const command = join(root, "convert")
    const source = join(root, "document.docx")
    await writeFile(source, "source")
    await writeFile(command, `#!/usr/bin/env node\nconst fs = require('node:fs')\nconst path = require('node:path')\nconst args = process.argv.slice(2)\nfs.writeFileSync(path.join(args[args.indexOf('--outdir') + 1], 'document.pdf'), 'converted')\n`)
    await chmod(command, 0o755)
    const result = await withOfficePdf(source, command, new AbortController().signal,
      async path => readFile(path, "utf8"))
    expect(result).toBe("converted")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
