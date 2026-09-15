import { fileURLToPath } from "node:url"

const root = new URL("../", import.meta.url)
const manifest = await Bun.file(new URL("package.json", root)).json() as { dependencies: Record<string, string> }
// Explicit dependency names keep internal @/ aliases bundled instead of treating them as packages.
const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL("src/backend/index.ts", root))],
  outdir: fileURLToPath(new URL("dist/backend", root)),
  target: "bun",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  external: Object.keys(manifest.dependencies),
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  throw new Error("Backend build failed")
}
console.log(`Backend built: ${result.outputs.length} output file(s)`)
