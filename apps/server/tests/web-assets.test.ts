import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { serveWebAsset } from "@/backend/api/web-assets"

test("built web assets serve HTML and cache hashed assets without exposing outside files", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-web-"))
  try {
    await mkdir(join(root, "assets"))
    await writeFile(join(root, "index.html"), "<html>Simula</html>")
    await writeFile(join(root, "assets/app-hash.js"), "export default 1")
    const read = (path: string, method = "GET") => serveWebAsset(new Request(`http://localhost${path}`, { method }), root)
    const html = await read("/")
    expect(await html.text()).toBe("<html>Simula</html>")
    expect(html.headers.get("cache-control")).toBe("no-cache")
    const asset = await read("/assets/app-hash.js")
    expect(asset.headers.get("cache-control")).toContain("immutable")
    expect(await asset.text()).toBe("export default 1")
    expect((await read("/assets/missing.js")).status).toBe(404)
    expect((await read("/..%2foutside-file")).status).toBe(404)
    expect((await read("/", "POST")).status).toBe(405)
    expect(await (await read("/assets/app-hash.js", "HEAD")).text()).toBe("")
  } finally { await rm(root, { recursive: true, force: true }) }
})
