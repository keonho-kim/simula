/**
 * Purpose: Mount the browser-owned Simula application at the root route.
 * Pattern: App Router page.
 * Usage: Rendered by Next.js for /.
 * Related: src/app/client-app.tsx, src/ui/shell/App.tsx
 */
import { ClientApp } from "./client-app"

export default function HomePage() { return <ClientApp /> }
