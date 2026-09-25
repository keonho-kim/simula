/**
 * Purpose: Construct JSON and text API responses at the HTTP boundary.
 * Pattern: Response adapter.
 * Usage: Imported by API controllers and the Node.js transport boundary.
 * Related: src/backend/api/routes.ts, server.ts
 */
export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
}

export function text(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
    },
  })
}
