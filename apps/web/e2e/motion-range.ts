/**
 * Purpose: Measure visible movement across animation frames in browser workflows.
 * Pattern: Browser test measurement.
 * Usage: Imported by preparation and constrained-client motion tests.
 * Related: apps/web/e2e/preparation-overlay.e2e.ts, apps/web/e2e/motion-performance.e2e.ts
 */
import type { Locator } from "@playwright/test"

export function motionRange(element: Locator, property: "top" | "opacity"): Promise<number> {
  return element.evaluate(async (node, measuredProperty) => {
    const values: number[] = []
    for (let index = 0; index < 8; index++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      values.push(measuredProperty === "top" ? node.getBoundingClientRect().top : Number(getComputedStyle(node).opacity))
    }
    return Math.max(...values) - Math.min(...values)
  }, property)
}
