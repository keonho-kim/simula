/**
 * Purpose: Keep OPFS and browser session initialization outside server rendering.
 * Pattern: Client-only boundary.
 * Usage: Rendered by the Next.js page routes.
 * Related: src/ui/shell/client-root.tsx, src/app/page.tsx
 */
"use client"

import dynamic from "next/dynamic"

const ClientRoot = dynamic(() => import("@/ui/shell/client-root"), { ssr: false })

export function ClientApp() { return <ClientRoot /> }
