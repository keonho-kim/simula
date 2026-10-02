/**
 * Purpose: Expose the simulation management workspace as a reloadable Next route.
 * Pattern: Framework route entry.
 * Usage: Next serves /simulations through the browser composition root.
 * Related: src/app/client-app.tsx, src/ui/pages/simulations-page.tsx
 */
import { ClientApp } from "../client-app"

export default function SimulationsRoute() { return <ClientApp /> }
