/**
 * Purpose: Provide a stable simulation URL while the browser retains run state.
 * Pattern: App Router page.
 * Usage: Rendered by Next.js for /simulation.
 * Related: src/app/client-app.tsx, src/ui/shell/App.tsx
 */
import { ClientApp } from "../client-app"

export default function SimulationPage() { return <ClientApp /> }
