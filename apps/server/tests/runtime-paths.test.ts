import { copyFile, mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const entry = join(root, "src/backend/config.ts")
async function readPaths(cwd: string, overrides: Record<string, string> = {}, configEntry = entry) {
  const env = { ...process.env }
  for (const key of ["SIMULA_DATA_DIR", "SIMULA_SETTINGS_PATH", "SIMULA_ENV_TOML_PATH", "SIMULA_SAMPLE_DIR"]) delete env[key]
  const child = Bun.spawn([process.execPath, "-e", `const config = await import(${JSON.stringify(configEntry)}); console.log(JSON.stringify([config.DATA_ROOT, config.SETTINGS_PATH, config.ENV_TOML_PATH, config.SAMPLE_ROOT]))`], {
    cwd, env: { ...env, ...overrides }, stdout: "pipe", stderr: "pipe",
  })
  const [output, error, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (status) throw new Error(error)
  return JSON.parse(output) as string[]
}

test("runtime defaults resolve against the checkout regardless of launch directory", async () => {
  const expected = ["runs", "settings.json", "env.toml", "senario.samples"].map((path) => resolve(root, path))
  expect(await readPaths(root)).toEqual(expected)
  expect(await readPaths(join(root, "apps/server"))).toEqual(expected)
})

test("relative overrides use the checkout while explicit absolute paths remain intact", async () => {
  const customSettings = resolve(root, "custom/settings.json")
  const paths = await readPaths(join(root, "apps/server"), { SIMULA_DATA_DIR: "custom/runs", SIMULA_SETTINGS_PATH: customSettings })
  expect(paths[0]).toBe(resolve(root, "custom/runs"))
  expect(paths[1]).toBe(customSettings)
})


test("moving the checkout changes all default paths to the new location", async () => {
  const relocated = await realpath(await mkdtemp(join(tmpdir(), "simula-relocated-")))
  try {
    const backend = join(relocated, "src/backend")
    await mkdir(backend, { recursive: true })
    const config = join(backend, "config.ts")
    await copyFile(entry, config)
    expect(await readPaths(root, {}, config)).toEqual(
      ["runs", "settings.json", "env.toml", "senario.samples"].map((path) => join(relocated, path))
    )
  } finally {
    await rm(relocated, { recursive: true, force: true })
  }
})
