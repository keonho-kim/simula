/**
 * Purpose: Convert supported Office documents to bounded PDFs for page evidence.
 * Pattern: External process adapter.
 * Usage: Called by document jobs before PDF.js page extraction.
 * Related: src/backend/runtime/documents.ts, src/backend/integrations/documents/pdf-vision.ts
 */
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import { spawn } from "node:child_process"
import { tmpdir } from "node:os"
import { basename, extname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { DocumentError } from "@/backend/core/documents/validation"

const CONVERSION_TIMEOUT_MS = 90_000
const MAX_CONVERTED_BYTES = 64 * 1024 * 1024

export async function withOfficePdf<T>(inputPath: string, command: string, signal: AbortSignal,
  consume: (path: string) => Promise<T>): Promise<T> {
  signal.throwIfAborted()
  const directory = await mkdtemp(join(tmpdir(), "simula-office-pdf-"))
  const output = join(directory, "output")
  await mkdir(output)
  try {
    const profile = pathToFileURL(join(directory, "profile")).href
    const child = spawn(command, [`-env:UserInstallation=${profile}`, "--headless", "--convert-to", "pdf", "--outdir", output, inputPath], {
      stdio: "ignore",
    })
    const kill = () => child.kill()
    signal.addEventListener("abort", kill, { once: true })
    let timedOut = false
    let tooLarge = false
    const timeout = setTimeout(() => { timedOut = true; kill() }, CONVERSION_TIMEOUT_MS)
    const monitor = setInterval(() => { void readdir(output).then(files => Promise.all(files.map(async name => (await stat(join(output, name))).size)))
      .then(sizes => { if (sizes.some(size => size > MAX_CONVERTED_BYTES)) { tooLarge = true; kill() } }).catch(() => undefined) }, 500)
    try {
      if (signal.aborted) kill()
      const code = await new Promise<number>((resolve, reject) => {
        child.once("error", reject)
        child.once("exit", code => resolve(code ?? -1))
      }).catch(error => {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          throw new DocumentError("converter_unavailable", "Install LibreOffice and expose soffice on PATH.", 503)
        }
        throw error
      })
      signal.throwIfAborted()
      if (timedOut) throw new DocumentError("conversion_timeout", "Office conversion exceeded its time budget.", 504)
      if (tooLarge) throw new DocumentError("conversion_too_large", "Split this document into smaller files.", 413)
      if (code !== 0) throw new DocumentError("conversion_failed", "Office conversion failed; check the file and LibreOffice installation.", 422)
      const path = join(output, `${basename(inputPath, extname(inputPath))}.pdf`)
      if ((await stat(path)).size > MAX_CONVERTED_BYTES) throw new DocumentError("conversion_too_large", "Split this document into smaller files.", 413)
      return await consume(path)
    } finally { clearTimeout(timeout); clearInterval(monitor); signal.removeEventListener("abort", kill) }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
