/**
 * Purpose: Verify stable browser URLs restore the intended view and run.
 * Pattern: Pure projection test.
 * Usage: Run by bun test src/ui/shell/browser-route.test.ts.
 * Related: src/ui/shell/browser-route.ts
 */
import { expect, test } from "bun:test"
import { pathForView, viewFromPath } from "./browser-route"

test("a report URL selects its run over an older session", () => {
  expect(viewFromPath("/reports/new-run", { runId: "old-run", viewMode: "simulation" }))
    .toEqual({ viewMode: "report", runId: "new-run" })
})

test("home and simulation URLs retain only the appropriate session data", () => {
  expect(viewFromPath("/", { runId: "run-1", viewMode: "report" }))
    .toEqual({ viewMode: "home", runId: "run-1" })
  expect(viewFromPath("/simulation", { runId: "run-1" }))
    .toEqual({ viewMode: "simulation", runId: "run-1" })
  expect(viewFromPath("/scenario-board", { runId: "run-1" }))
    .toEqual({ viewMode: "board", runId: "run-1" })
  expect(viewFromPath("/scenario-board", {})).toEqual({ viewMode: "home" })
})

test("view URLs are stable and a report requires its run", () => {
  expect(pathForView("home", "run-1")).toBe("/")
  expect(pathForView("simulation", "run-1")).toBe("/simulation")
  expect(pathForView("board", "run-1")).toBe("/scenario-board")
  expect(pathForView("board", undefined)).toBeUndefined()
  expect(pathForView("report", "run-1")).toBe("/reports/run-1")
  expect(pathForView("report", undefined)).toBeUndefined()
})
