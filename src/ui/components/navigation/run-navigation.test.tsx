/**
 * Purpose: Verify world-return navigation is labeled and limited to its owning run.
 * Pattern: Static presentation contract test.
 * Usage: bun test src/ui/components/navigation/run-navigation.test.tsx
 * Related: src/ui/components/navigation/run-navigation.tsx
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { RunNavigation } from "./run-navigation"

for (const locale of ["ko", "en"] as const) test(`world headers show return; other runs retain home (${locale})`, () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  const worldId = "33333333-3333-4333-8333-333333333333", runId = `world-${worldId}`
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => JSON.stringify({ scenarioId: "11111111-1111-4111-8111-111111111111",
      batchId: "22222222-2222-4222-8222-222222222222", worldId, runId }),
  } })
  try {
    const t = dictionary[locale]
    const world = renderToStaticMarkup(<RunNavigation runId={runId} onHome={() => {}} onBackToWorlds={() => {}} t={t} />)
    expect(world).toContain(`${t.batchBackToWorlds}</button>`)
    expect(world).not.toContain(`${t.home}</button>`)
    const other = renderToStaticMarkup(<RunNavigation runId="standalone" onHome={() => {}} onBackToWorlds={() => {}} t={t} />)
    expect(other).toContain(`${t.home}</button>`)
    expect(other).not.toContain(t.batchBackToWorlds)
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
})
