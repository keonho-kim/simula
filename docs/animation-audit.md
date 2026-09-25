# Frontend animation audit

## Scope and decisions

This audit covers authored frontend CSS, shadcn primitives, page components, graph rendering,
actor history, metrics, streaming detail, and time-driven workflows. The original measurements
below predate the Motion consolidation described at the end of this document. Motion 13.3.0 owns
DOM presence, position, and selection transitions; Radix continues to own focus, keyboard, and
popup accessibility behavior. Native CSS remains for static states and short color feedback.

| Surface | Implementation and decision |
| --- | --- |
| Dialog and dropdown | Radix owns state; Motion now animates 100–120 ms opacity entrances/exits. No backdrop blur or zoom. |
| Tooltip | Radix owns hover/focus state; Motion handles a 100 ms entrance/exit. |
| Button, input, textarea, select, badge, slider, settings/actor choices | Keep native interactions and explicitly bounded 100 ms color feedback. |
| Switch and tab indicator | Motion owns the thumb, indicator opacity, and tab content entrance. |
| Start cards | Motion now owns hover/focus/tap displacement; reduced-motion disables displacement. |
| Scenario board layout | Lazy-loaded Motion with domMax/m, position-only layout interpolation at 240 ms. Only section containers participate; individual rows are not Motion elements. Preserve the selected column DOM instead of remounting the whole board. |
| Scenario board detail | Motion owns 150 ms opacity entrance/exit. Live preview updates do not rerender the layout tree. |
| Board activity | Motion pulses at most one active row; other parallel actors retain a static pastel highlight. |
| Board percentage | Motion moves ten dots while visible and running. The percentage never moves or counts up. |
| Graph | Keep Sigma camera and Graphology interpolation: these are canvas data, not DOM layout. Existing 120 ms transitions and Worker layout remain. Identical layouts now schedule no frames or graph updates. Layout results received in a hidden document apply immediately. |
| Graph active status | Existing single next-expiry timer; no perpetual per-edge animation. |
| Actor history | Keep measured virtualization and follow-latest behavior; no entrance animation per message or smooth-scroll backlog. |
| Metrics and report charts | Values/path data update immediately; Motion provides one short chart entrance without count-up, path drawing or particle loop. |
| Toasts and scrollbars | Retain the existing shadcn/Sonner/Radix behavior. No extra animation wrapper. |
| Replay and round countdown | Keep 800 ms replay steps and the existing round timers: these express product timing, not decorative animation. |
| General SSE | Keep requestAnimationFrame batching for event projection. Detail SSE remains immediate and scoped to the open item. |

Motion receives a reactive media-query preference: toggling the OS/browser setting works without
a reload, including opacity. Repeating board motion stops on document visibility changes. Native
color transitions obey the global reduced-motion rule. No hardware guessing or automatically
changing user preferences is introduced.

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

At the time of this earlier audit, the production board chunk grew from 2.99 kB to about 43 kB
gzip, including Motion. The consolidation later placed Motion behind browser startup for landing
and popup transitions; the earlier chunk comparison no longer describes the current bundle split.

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

Earlier audit verification: 185 Bun tests, typecheck, lint, production build, and all 15 Playwright workflows passed (`--workers=1`). The performance workflow also checks that 20 parallel active actors produce only one pulsing row.

## Motion consolidation

The browser startup boundary loads shared `domAnimation` features only after storage opens.
Scenario Board retains a nested `domMax` boundary for its position-only layout transition.
`src/ui/animation` now owns the Motion provider, timing scale, reusable fade/slide presence,
card/press interactions, bounded board activity effects, visibility and reduced-motion hooks,
and native CSS feedback duration. Components retain their semantic state, keys, layout, and
Radix accessibility behavior. The graph's frame-by-frame canvas coordinates remain with the
graph renderer because they are tied to Graphology and Sigma rather than DOM presence.
Product navigation, scenario-builder stages and task details, world launch modes, analytical
report tasks and chart entrance, selected report rounds, simulation event notices, switches,
progress indicators, tabs, and Radix popup surfaces now use Motion for visible movement and
presence. `tw-animate-css` is no longer imported or installed. Basic control color feedback,
focus rings, scrolling, and Sigma's canvas coordinate interpolation remain with their platform
owners. Conditional dialogs stay mounted through the 120 ms exit, and closing a round modal
stops its continuation timer immediately. Repeated board motion stops when the document is
hidden, when preparation completes, or when reduced motion is selected.

The constrained Chromium workflow still completed six board detail/back cycles with 6x CPU
throttling and 100 ms network latency. One illustrative run recorded 1.325 s task time,
0.335 s script time, 0.103 s layout time, and 0.092 s style recalculation time. These numbers
are not a controlled comparison to the earlier audit and are not a real VDI FPS measurement.
