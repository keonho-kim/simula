/**
 * Purpose: Provide a reloadable URL for report generation before accepted results.
 * Pattern: App Router page.
 * Usage: Rendered by Next.js for /reports/[runId]/prepare.
 * Related: src/app/client-app.tsx, src/ui/shell/report-flow.tsx
 */
import { ClientApp } from "../../../client-app"

export default function ReportPreparationPage() { return <ClientApp /> }
