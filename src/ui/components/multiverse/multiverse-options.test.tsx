/**
 * Purpose: Verify accessible world-count controls without a browser or model.
 * Pattern: Static rendering tests.
 * Usage: bun test src/ui/components/multiverse/multiverse-options.test.tsx
 * Related: src/ui/components/multiverse/multiverse-options.tsx
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { MultiverseOptions } from "./multiverse-options"

for (const locale of ["en", "ko"] as const) test(`checkbox reveals the chosen bounded world count (${locale})`, () => {
  const render = (enabled: boolean) => renderToStaticMarkup(<MultiverseOptions value={{ enabled, worldCount: 4 }} onChange={() => {}} t={dictionary[locale]} />)
  expect(render(false)).toContain('type="checkbox"')
  expect(render(false)).not.toContain('type="number"')
  expect(render(true)).toContain('type="number"')
  expect(render(true)).toContain('value="4"')
  expect(render(true)).toContain('max="50"')
  expect(render(true)).toContain(dictionary[locale].batchWorldCount)
})
