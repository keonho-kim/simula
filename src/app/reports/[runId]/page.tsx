/**
 * Purpose: Provide a stable report URL while browser SQLite owns report history.
 * Pattern: App Router page.
 * Usage: Rendered by Next.js for /reports/[runId].
 * Related: src/app/client-app.tsx, src/ui/shell/App.tsx
 */
import { ClientApp } from "../../client-app"

export default function ReportPage() { return <ClientApp /> }
