# Frontend animation audit

## Scope and decisions

This audit covers authored frontend CSS, shadcn primitives, page components, graph rendering,
actor history, metrics, streaming detail, and time-driven workflows. Motion 13.3.0 (MIT,
React 18/19 peer support) is used for actual DOM layout transitions. Existing shadcn
CSS primitives continue using tw-animate-css; replacing them with JavaScript animation
would add work without a corresponding interaction benefit.

| Surface | Implementation and decision |
| --- | --- |
| Dialog and dropdown | Keep shadcn/Radix state-driven, 100 ms opacity entrances/exits. No backdrop blur or zoom. |
| Tooltip | Keep shadcn lifecycle; remove the remaining zoom and use 100 ms fade. |
| Button, input, textarea, select, badge, slider, settings/actor choices | Keep native interactions and explicitly bounded 100 ms color feedback. |
| Switch and tab indicator | 100 ms transform/opacity feedback; no layout interpolation. |
| Start cards | Remove hover shadow changes and redundant transform transition; use color feedback. |
| Scenario board layout | Lazy-loaded Motion with domMax/m, position-only layout interpolation at 240 ms. Only section containers participate; individual rows are not Motion elements. Preserve the selected column DOM instead of remounting the whole board. |
| Scenario board detail | 150 ms opacity entrance. Live preview hook is owned by the memoized detail component, so incoming text does not rerender the board/layout tree. |
| Board activity | Keep requested gray/green/blue statuses. At most one active row pulses; other parallel actors retain a static pastel highlight. |
| Board percentage | Keep requested ten-dot transform wave. The percentage never moves or counts up. |
| Graph | Keep Sigma camera and Graphology interpolation: these are canvas data, not DOM layout. Existing 120 ms transitions and Worker layout remain. Identical layouts now schedule no frames or graph updates. Layout results received in a hidden document apply immediately. |
| Graph active status | Existing single next-expiry timer; no perpetual per-edge animation. |
| Actor history | Keep measured virtualization and follow-latest behavior; no entrance animation per message or smooth-scroll backlog. |
| Metrics and report charts | Keep immediate values/path changes and 100 ms control colors; no count-up, path drawing or particle loop. |
| Toasts and scrollbars | Retain the existing shadcn/Sonner/Radix behavior. No extra animation wrapper. |
| Replay and round countdown | Keep 800 ms replay steps and the existing round timers: these express product timing, not decorative animation. |
| General SSE | Keep requestAnimationFrame batching for event projection. Detail SSE remains immediate and scoped to the open item. |

All authored CSS animations stop with prefers-reduced-motion. Motion receives a reactive media
query preference: toggling the OS/browser setting works without a reload, including opacity.
Decorative CSS animations pause on document visibility changes. Continuous work is not added to
hidden UI. No hardware guessing or automatically changing user preferences is introduced.

## Measurements

Command: `bun run test:e2e apps/web/e2e/motion-performance.e2e.ts --workers=1`.
The test uses Chromium at 1440 x 1000, 6x CPU throttling, 100 ms network latency, 100
scenario events, and six detail/back cycles after warm-up. CDP Performance counters describe
browser work, not network-to-display latency in a real VDI installation.

| Counter | Previous CSS/remount implementation | Final 240 ms Motion implementation |
| --- | ---: | ---: |
| Task duration during measured cycles (s) | 2.541 | 3.007 |
| Script duration (s) | 1.403 | 1.666 |
| Layout duration (s) | 0.082 | 0.094 |
| Style recalculation duration (s) | 0.237 | 0.174 |
| Layout count | 24 | 48 |
| Style recalculation count | 312 | 274 |

These are illustrative local runs, not a statistically controlled FPS benchmark. The transition now settles in 240 ms rather than 400 ms and measured style work decreases, while Motion's real position measurement costs
more script/layout time than the old whole-panel fade. Do not claim an across-the-board CPU or
FPS improvement. The initial 400 ms Motion trial cost 3.234 s task time, motivating the 240 ms
limit. Real VDI transport, GPU availability, resolution and host contention remain unmeasured.

The production board chunk grows from 2.99 kB to about 43 kB gzip, including Motion. It remains
behind the existing lazy simulation boundary. The initial JS entry is essentially unchanged
(144.27 to 144.32 kB gzip in these builds); Motion is not imported into the landing entry.

Other checks: 1,000-node Worker layout returned finite coordinates while browser animation frames
continued; 4,120 conversation messages retained only 13 mounted rows in the test viewport.
Unchanged graph-layout tests assert zero scheduled frames and zero graph writes. Browser tests
verify the original selected column stays connected, independent scrolling, 40:60 layout,
background animation pause, reduced-motion behavior, and normal simulation/report workflows.

The first broad parallel test run had development-page navigation interruptions and contention
in the resize/virtual-scroll check. Isolated runs and the sequential audit are the reproducible
validation path for this shared-server performance workload. Smoke assertions were updated to
the existing current locale labels, rendered Markdown, report tabs and explicit auto-continue
contract; application behavior was not changed to satisfy stale assertions.

A stale initial run snapshot could reset board readiness after live events had already completed it. The store now deduplicates board lifecycle/artifact events across snapshots and live delivery, with a regression test for that ordering. This prevents a data-driven modal reopening from looking like animation jitter.

Final verification: 185 Bun tests, typecheck, lint, production build, and all 15 Playwright workflows passed (`--workers=1`). The performance workflow also checks that 20 parallel active actors produce only one pulsing row.
