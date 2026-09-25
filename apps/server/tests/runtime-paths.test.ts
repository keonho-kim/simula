/**
 * Purpose: Verify bundled sample paths stay relative to the checkout.
 * Pattern: Runtime configuration contract test.
 * Usage: bun test apps/server/tests/runtime-paths.test.ts
 * Related: src/backend/config.ts
 */
import { copyFile, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const entry = join(root, "src/backend/config.ts")
async function readPaths(cwd: string, overrides: Record<string, string> = {}, configEntry = entry) {
  const env = { ...process.env }
  delete env.SIMULA_SAMPLE_DIR
  const child = Bun.spawn([process.execPath, "-e", `const config = await import(${JSON.stringify(configEntry)}); console.log(JSON.stringify([config.SAMPLE_ROOT]))`], {
    cwd, env: { ...env, ...overrides }, stdout: "pipe", stderr: "pipe",
  })
  const [output, error, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (status) throw new Error(error)
  return JSON.parse(output) as string[]
}

test("runtime defaults resolve against the checkout regardless of launch directory", async () => {
  const expected = [resolve(root, "senario.samples")]
  expect(await readPaths(root)).toEqual(expected)
  expect(await readPaths(join(root, "apps/server"))).toEqual(expected)
})

test("sample override uses the checkout", async () => {
  const paths = await readPaths(join(root, "apps/server"), { SIMULA_SAMPLE_DIR: "custom/samples" })
  expect(paths).toEqual([resolve(root, "custom/samples")])
})


test("moving the checkout changes all default paths to the new location", async () => {
  const relocated = await realpath(await mkdtemp(join(tmpdir(), "simula-relocated-")))
  try {
    const backend = join(relocated, "src/backend")
    await mkdir(backend, { recursive: true })
    const config = join(backend, "config.ts")
    await copyFile(entry, config)
    expect(await readPaths(root, {}, config)).toEqual(
      [join(relocated, "senario.samples")]
    )
  } finally {
    await rm(relocated, { recursive: true, force: true })
  }
})
