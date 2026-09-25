/**
 * Purpose: Provide the shared Next.js document shell for browser-owned application views.
 * Pattern: App Router layout.
 * Usage: Rendered by Next.js for every page route.
 * Related: src/app/page.tsx, src/ui/index.css
 */
import type { Metadata } from "next"
import "@/ui/index.css"

export const metadata: Metadata = { title: "Simula", icons: { icon: "/favicon.svg" } }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>
}
