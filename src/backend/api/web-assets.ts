import { relative, resolve, sep } from "node:path"

export async function serveWebAsset(request: Request, root: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } })
  let pathname: string
  try { pathname = decodeURIComponent(new URL(request.url).pathname) }
  catch { return new Response("Invalid path", { status: 400 }) }
  const filePath = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`)
  const localPath = relative(root, filePath)
  if (localPath === ".." || localPath.startsWith(`..${sep}`)) return new Response("Not found", { status: 404 })
  const file = Bun.file(filePath)
  if (!await file.exists()) return new Response("Not found", { status: 404 })
  const headers = { "Content-Type": file.type, "Cache-Control": localPath.startsWith(`assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache" }
  return new Response(request.method === "HEAD" ? null : file, { headers })
}
