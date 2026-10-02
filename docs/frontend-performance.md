# Frontend Rendering Performance

The frontend keeps the existing screens, full actor history, chart samples, round controls,
and replay behavior. This change targets repeated computation and unrelated subscriptions.

## Responsibility Boundaries

| Module | Owns |
| --- | --- |
| `src/ui/hooks/use-round-progression.ts` | Round confirmation, continuation, cancellation, and the auto-continue preference. App subscribes to round/terminal changes rather than every log or metric event. |
| `src/ui/stores/run/event-collections.ts` | Event identity, deduplication, and the metric, actor-detail, conversation, and stage collections. |
| `src/ui/stores/run/selectors.ts` | Stable scalar/reference projections for round controls. |
| `src/ui/models/metrics/metric-series.ts` | Full metric-series and cumulative-token calculations. |
| `src/ui/models/metrics/line-path.ts` | SVG geometry; calculate the vertical scale once per series. |
| `src/ui/components/metrics/line-chart.tsx` | Chart presentation. |
| `src/ui/components/graph/renderer/` | Sigma lifecycle, camera, graph updates, and interaction state. |
| `src/ui/components/graph/overlays/` | Node/pointer positioning and edge preview presentation. |
| `src/ui/models/actors/actor-details.ts` | Actor detail, history, and reasoning projections without React rendering. |
| `src/ui/components/actors/history/` | Memoized message cards, detail subscriptions, and measured virtual scrolling. |
| `src/ui/pages/scenario-board-page.tsx` | Scenario preparation page and on-demand detail rendering. |

Graph, actor rail, stage, and metric panel boundaries are memoized. Message cards receive stable
primitive props, so an appended interaction does not re-render unchanged cards. Graph camera
updates do not trigger React overlay updates when no actor is selected. Actor text replacement
patterns are prepared once for a batch instead of once per field per message.

Retained event identity indexes belong to the store's run lifecycle and are cleared on reset.
Duplicate history updates preserve collection references. Conversation subscribers receive only
actor readiness and recorded interactions; metric/reasoning traffic does not invalidate them.
Stage events exclude metric/reasoning/log/chart/report payloads that its models do not consume.

Round controls use a constant-sized, run-scoped progress projection independent of the
300-event display window. Telemetry eviction and replayed history cannot erase terminal
state or rewind a completed round. Unrelated events preserve the projection reference;
an explicit `awaitsContinuation: false` suppresses a final-round approval prompt. This
is a lifecycle correctness guarantee, not a measured rendering-speed improvement.

## Measurements

Run from the repository root:

```sh
bun apps/web/benchmarks/rendering.tsx
```

The script generates deterministic metric events, warms each operation, and reports the median
of five runs. Ingestion uses batches of 20. These local measurements are CPU costs for server-side
React chart rendering and store ingestion, not browser FPS or real-provider response latency.

| Workload | Before (ms) | After (ms) |
| --- | ---: | ---: |
| Render metrics panel, 1,000 samples | 29.56 | 2.80 |
| Render metrics panel, 4,000 samples | 453.04 | 8.36 |
| Ingest 1,000 metrics in batches | 5.55 | 2.28 |
| Ingest 4,000 metrics in batches | 60.09 | 11.05 |

For 200 batches containing 4,000 metrics, the raw live-event collection changes 200 times, while
round-control, conversation, and stage subscription values each change zero times. The metrics
panel still receives every sample. All HTML and SVG output was compared with the pre-change
renderer at 0, 1, 17, and 1,000 samples and was identical.

The original measurements above predate the bounded-rendering pass below. Raw history and metric
datasets remain complete; the current implementation virtualizes history DOM and samples only the
chart presentation.

## Verification

```sh
bun test
bun run typecheck
bun run lint
bun run build
bun run test:e2e actor-rail.e2e.ts round-continuation.e2e.ts
```

The browser checks exercise actor details, the 60:40 layout, graph/report navigation, follow-latest
scrolling, manual continuation, and the five-second auto-continue countdown with cancellation.

## Animation and event ordering follow-up

- Graphology attribute events already make Sigma schedule rendering. Layout and edge animation
  ticks no longer also perform a synchronous full-graph refresh. Reducer-only changes still request
  a scheduled refresh explicitly.
- Active actor highlighting uses the next expiry time instead of a continuous animation-frame
  loop. Repeated activity extends the deadline without repainting an unchanged highlight set.
- ForceAtlas2 returns target coordinates without first writing them into the live graph and then
  restoring the old coordinates. Interpolation alone writes the visible positions.
- Actor popover coordinates are read after Sigma renders. Unchanged coordinates retain their
  React state reference, removing the previous revision-update followed by position-update cycle.
- Selecting a different actor starts one camera movement. Selecting the same actor can still
  refocus it. Animation frames and highlight timers are canceled when the renderer unmounts.
- Stream completion flushes queued events before showing the report confirmation or invalidating
  queries. One `runs` prefix invalidation covers both the list and detail query; a second detail
  invalidation would repeat work.
- `stores/run/timeline.ts` merges immutable frames by index. HTTP/SSE overlap cannot duplicate
  frames, and an older HTTP snapshot cannot remove newer streamed frames. Duplicate snapshots
  preserve the timeline reference.
- ActorRail subscribes to its replay cutoff timestamp rather than the whole timeline. Report
  detail dialogs subscribe and build their projections only while open.

Focused logic checks cover overlapping snapshots, highlight expiry/extension, animation target
positions, edge weight transitions, and cancellation. The four actor-history and round-control
browser workflows also pass. The broader legacy smoke suite currently has two independent
failures: it waits for completion without continuing manual rounds, and expects an outdated
Korean home heading. Those tests were not changed by this optimization.

## Worker layout and incremental projections

Graph layout now lives in `components/graph/layout/`:

- `protocol.ts`: compact node positions, sizes, edges, and weights crossing the worker boundary.
- `options.ts` and `calculate.ts`: deterministic ForceAtlas2 configuration and calculation.
- `layout.worker.ts`: worker entry point.
- `worker-client.ts`: one in-flight request per renderer, cancellation, errors, and result delivery.

ForceAtlas2 runs in a module Worker. New layout requests terminate obsolete work; renderer cleanup
and backward replay also cancel pending requests. Late messages cannot apply after cancellation.
The main thread keeps rendering the current graph while waiting and interpolates from its current
positions when the result arrives. Layout failures are explicit; there is no synchronous fallback.
The Next.js Webpack build emits a separate worker asset in the production build.

`models/metrics/metric-data.ts` accumulates new metric points and token totals. `metric-series.ts`
only formats the shared data for the current locale. `models/actors/conversation-data.ts` normalizes
new messages and preserves unchanged rounds/messages. Actor metadata changes deliberately rebuild
existing visible text so names and action labels remain correct. Replay filters the already
normalized messages without repeating text replacement.

The run store owns both projections and updates them after deduplication. HTTP hydration and SSE
share the same update path. UI components subscribe to those shared results rather than rebuilding
them independently. Prior snapshots remain immutable; reset clears both projections.

### Measurements and validation

```sh
bun apps/web/benchmarks/projections.ts
bun apps/web/benchmarks/rendering.tsx
bun run test:e2e actor-rail.e2e.ts round-continuation.e2e.ts layout-worker.e2e.ts
```

For 4,000 events arriving in batches of 20, the projection benchmark warms each operation and
reports the median of five runs. Both approaches produce deeply equal final results.

| Projection workload | Recompute full history (ms) | Incremental (ms) |
| --- | ---: | ---: |
| Metric points and token totals | 49.52 | 4.27 |
| Conversation messages and rounds | 53.96 | 2.08 |

A Chromium check calculated a 1,000-node graph in a Worker. During 258 ms of worker startup,
calculation, and message delivery, the main thread advanced 17 animation frames. This verifies
responsiveness during layout; it is not an overall application FPS measurement. Timing varies
by machine and browser load.

All 178 logic tests and the five focused browser workflows passed. Type checking, lint, and
production build passed. The existing legacy smoke failures described above remain outside this
change. Tests cover projection equivalence, prior snapshot preservation, metadata changes,
duplicate ingestion, reset, replay cutoff, obsolete worker results, cancellation, and errors.

The worker/incremental pass initially left full SVG generation, flat snapshot copies, and mounted
history DOM costs in place. The following bounded-rendering pass addresses those costs.


## Five bounded-rendering improvements

The five-item pass originally preserved animation timings. The subsequent VDI pass below changes
the motion policy explicitly to favor immediate feedback on constrained clients.

1. **SVG budget.** `models/metrics/sample-history.ts` selects at most 258 display points across the
   entire history. Each bucket retains its minimum and maximum and the first/latest samples remain
   present. Original sample indices preserve their horizontal positions. Chunk extrema allow the
   renderer to avoid scanning every raw sample. Full-resolution data and exact totals are retained.
2. **Virtual actor history.** Live messages use `components/actors/history/live-history.tsx`
   with TanStack element virtualization, measured variable heights, overscan, stable keys, and
   end anchoring inside the bounded chat panel. Reading upward pauses following; returning to
   the panel bottom resumes it. Archived report messages use `virtual-history.tsx` against the
   report's bounded dialog scroll surface. The simulation itself fits the viewport; only
   its chat history scrolls. Width changes invalidate measurements, focused rows remain mounted, and the
   mutable virtualizer stays outside React Compiler memoization. A browser test injects 4,120
   messages and verifies that fewer than 40 cards are mounted.
3. **Chunked metric snapshots.** Completed groups of 128 samples are shared across snapshots. Only
   the partial tail and new samples are allocated. The unused cumulative-token point history is
   replaced by an exact scalar total; original metric events remain available for analysis/export.
4. **Shared timeline records.** `models/graph/timeline-sharing.ts` reuses equal nodes, edges, and
   arrays between frames. The HTTP response is normalized before entering the query cache, and
   streamed live events reference the store's canonical frames. Changed records and replay values
   remain independent; prior frames are never mutated.
5. **Changed graph attributes only.** The frame writer avoids unchanged attribute writes and only
   reindexes parallel-edge curves when topology changes. Reducer refreshes still occur for actual
   selection/highlight changes; edge and position interpolation continue on animation frames.

### Local measurements

```sh
bun apps/web/benchmarks/render-budgets.ts
bun run test:e2e actor-rail.e2e.ts round-continuation.e2e.ts layout-worker.e2e.ts large-history.e2e.ts
```

| Workload | Before | After |
| --- | ---: | ---: |
| SVG path generation, 20,000 samples, median of five | 8.37 ms | 0.12 ms |
| SVG path text, same data | 783,868 characters | 6,158 characters |
| Append 20,000 samples in batches of 20, median of five | 15.81 ms | 1.61 ms |
| Distinct graph records across 1,000 synthetic frames | 150,000 | 2,148 |

The timeline comparison verifies deep equality. Distinct-object counts measure structural sharing,
not total browser heap bytes. The SVG benchmark measures generation, not overall application FPS.
The chart uses 158 display points for this fixture, while retaining all 20,000 raw samples.

A browser workflow injected 4,000 messages and found 12 mounted message cards at the end. It then
verified access to old messages, preservation of the top reading position while appending, resumed
following at the end, and mobile-width resizing, reaching 4,120 injected messages without data loss.
Offscreen rows are not DOM nodes, so native browser text search covers mounted content only.

All 181 logic tests and six focused browser workflows pass. Checks cover chunk sharing, exact
sample retention, endpoint/extrema preservation, bounded path size, timeline equality, canonical
stream references, zero writes for unchanged frames, unchanged intermediate easing positions,
and virtual scrolling. The earlier legacy smoke mismatches are not changed by this pass.


## VDI motion and reload recovery

The default interface now favors short, functional transitions. Graph layouts and camera moves use
120 ms transitions; reduced-motion preference makes those updates immediate. Layout interpolation
emits one bulk Graphology position update per animation frame. Edge width/color changes apply
immediately, eliminating their separate decoration loop. Numeric metrics show their final value
without count-up animation. Navigation, dialogs and selected content use short transform/opacity
transitions while only two progress dots and one active board row repeat during preparation.
No heavy backdrop blur is added. The report chart also computes
its vertical scale once per series instead of rescanning every sample for every point.

`storage/run-session.ts` keeps only the active run id, view, auto-continue preference, and handled
round numbers in tab-scoped session storage. Reloading reconnects to server events and restores the
simulation/report view. A continuation is not persisted as handled while its HTTP request is still
pending. This restores a browser view, not a stopped server process. The original external trigger
for a user's unexpected reload cannot be established from client source alone; defaulting every
remount to the home page was independently reproduced and corrected.

A browser workflow reloads during automatic progression with 6x CPU throttling and reduced motion,
then verifies that the simulation resumes and only two continuation requests advance three rounds.

The previous Vite build used dependency-aware chunking after a forced vendor partition caused
an initialization-order error. The current Next.js build uses Webpack and verifies worker loading
and browser workflows against the same server that hosts the API.

The Scenario Board is a separate `/scenario-board` page between landing and simulation. It uses an incremental artifact projection in `models/simulation/scenario-board.ts`. Telemetry-only batches preserve its reference. Only the selected artifact mounts Markdown detail content; the four board columns display titles and status markers. The page scrolls as one surface, while columns and details grow with their content. Its completion percentage sits between two five-dot waves. Motion moves only the dots while preparation is visible and running. At most one active row animates a pastel background using opacity; other parallel actors retain a static highlight. Reduced-motion users receive a static highlight. Phase indicators use gray for waiting, green for active, and blue for complete. The page advances to simulation when the first event or interaction is accepted and the reader has closed any open detail. Terminal runs always advance.

Board draft output is delivered immediately through an item-specific SSE subscription only while an unfinished detail is open. The runtime retains the current draft in memory and sends a snapshot before subsequent live deltas; token deltas are neither persisted nor sent through the general run stream. Stream identifiers and sequence numbers prevent repeated chunks after reconnects; retries reset the affected draft. Accepted results replace drafts, and board events are excluded from graph stage subscriptions.

Selecting an item switches to its column at 40% width and detail at 60% on desktop. Other columns unmount until the icon-only back button is selected. A reserved header slot keeps the title fixed. The new opaque view replaces the old one without a wait interval; its selected column and detail enter together from opposite horizontal directions. Switching detail items changes only the detail text. Streamed text updates only the memoized detail renderer, outside the page transition. Reduced-motion users get an immediate switch. See [the full animation audit](animation-audit.md) for frontend-wide decisions, historical measurements, and limitations.

## Current startup, history, and report pass

The browser now paints a localized startup surface before claiming the single-tab lock and
opening SQLite WASM. The database connection, credential gate, and application body load after
the first paint. Bundled examples are seeded only when the example picker requests them. SQLite
failure remains explicit, and a locked credential vault still gates the application. Landing
history reads run manifests without prefetching full run details; detail loading begins when a
run is opened.

Live actor history indexes round starts rather than creating a flat object for every message on
each append. The virtualizer resolves a visible row by binary search. A local synthetic fixture
with 500 rounds and 50,000 messages took 92.3 ms to flatten 100 times versus 2.3 ms to build
100 round indices and resolve 100 rows; these are CPU timings, not browser FPS. The 4,120-message
browser workflow still mounted only 15 rows at its measured scroll position.

The analytical report keeps a run-level metric summary and appends only new analytical calls
when polling returns an unchanged prefix. A changed report identity, base run event array, or
replaced metric prefix resets the summary. This preserves whole-run averages and provider-only
token accounting without rescanning base run events each second. The API still returns the full
analytical metric list on each poll, so network payload and parsing cost remain candidates for a
future measured change.

The server's active graph timeline uses an event projector with bounded message and log tails.
It no longer rereads the full event file or rewrites the full timeline after each graph frame;
the temporary timeline file is flushed at state and terminal boundaries. A local 2,101-event
projection fixture took 22.3 ms with full round replay and 2.4 ms with the projector, with equal
final frames. Browser-acknowledged event pruning retains active projection state. Server restart
does not resume an active run from a partial event log.

## Editorial workspace and immediate actor messages (2026-10-01)

The shared workspace occupies 80% of the viewport at every breakpoint. Source input,
scenario review, and settings are pages. Reports mount one chapter; recorded relationships,
conversation history, and execution metrics mount only when selected. The report conversation
list owns a bounded scroll viewport instead of looking for the former dialog ancestor.

Actor completion uses a separate, run-scoped SSE snapshot. React applies incoming snapshots
once per animation frame. The presentation projection reuses unchanged historical rounds and
message references, retains arrival order through confirmation, and tolerates a newer round
arriving before an earlier canonical event. Previews never enter durable browser projections.
Cancellation and visibility changes release the subscription; short entry animations also stop
when hidden. The renderer changes its palette without recreating Sigma, its camera, or its Worker.

### Measurement method

Baseline: the preceding Git HEAD, built in an isolated temporary checkout with the same installed
packages. Candidate: the working tree. Both used a production Next build, the E2E entry enabled,
Chromium at 1440 × 1000, reduced motion, local HTTP, and fresh browser contexts. No real model was
contacted. `apps/web/benchmarks/browser-workspace.ts` alternates baseline and candidate, warms up
once, then reports five-run medians. Each run opens and closes settings five times. This compares
the same user task across the former dialog and the new page, rather than equal DOM structures.
The script records CDP task, script, layout, and style-recalculation durations. Resource size is
encoded JavaScript response bytes; it is not the size of every lazy route combined.

Three independent browser batches gave consistent results (final batch shown):

| Measure | Baseline | Candidate |
| --- | ---: | ---: |
| Dashboard ready | 883.38 ms | 881.29 ms |
| First contentful paint | 334.91 ms | 335.18 ms |
| Initial JavaScript | 344,524 bytes | 345,510 bytes |
| Settings click to visible controls | 40.37 ms | 36.05 ms |
| CPU task time, five settings round trips | 217.60 ms | 153.66 ms |
| Script time, same task | 77.73 ms | 56.97 ms |
| Layout time, same task | 4.41 ms | 7.27 ms |
| Style recalculation, same task | 39.97 ms | 10.60 ms |

The page transition adds 2.86 ms of layout across five round trips while removing about 30 ms of
style recalculation. Combined layout and style cost falls from 44.38 ms to 17.87 ms. Overall task CPU
falls about 30%; startup is unchanged within the observed variation. The extra initial script
payload is 986 bytes (0.29%). The first batch showed the same direction: 216.04 → 155.36 ms task
CPU, 4.62 → 7.39 ms layout, and 40.03 → 10.94 ms style recalculation. Settings response includes Playwright click dispatch and waiting for visible controls. This is
local synthetic measurement, not a claim about field INP or provider latency.

The three existing CPU benchmarks retain their warmup and five-sample median method:

| Workload | Baseline | Candidate |
| --- | ---: | ---: |
| Render chart, 4,000 metrics | 1.31 ms | 1.30 ms |
| Ingest 4,000 metrics in batches of 20 | 11.62 ms | 11.81 ms |
| Incremental metrics projection | 0.69 ms | 0.69 ms |
| Incremental conversation projection | 1.65 ms | 1.99 ms |
| Bounded line geometry, 20,000 samples | 0.12 ms | 0.12 ms |
| Chunked append, 20,000 samples | 1.52 ms | 1.52 ms |

Conversation projection showed short-run variation: the preceding paired measurement was
2.08 → 2.02 ms. Its implementation is unchanged; the added live preview projection has a separate
reference-reuse test. Metric-only batches still produce zero round-control, conversation, and
stage subscriber updates. The chart fixture displays 158 points within the existing 258-point
limit and retains 6,158 path characters. Timeline sharing remains 2,148 graph records for the
1,000-frame fixture with equal final output.

The deterministic live browser fixture delivers actor B while actor A is still pending, then
commits A before B. It verifies B appears first and stays in that slot after confirmation. Twelve
message arrivals measured 6.63 ms p95 in Chromium and 13.26 ms in WebKit from receipt to card DOM
mutation in the active tab (preceding Chromium runs ranged from 6.21 to 6.59 ms). This excludes model generation and display scanout. The long-history
browser fixture contains 4,120 messages and mounts 14 cards at its measured position, below 40.

Viewport screenshots cover 1920, 1440, 1024, 768, 390, and 320 CSS pixels. Browser tests verify
workspace gutters, overflow, chapter unmounting, evidence focus restoration, draft restoration,
settings round trips, browser-back confirmation, and reduced motion. Transport tests verify
reconnect snapshots, terminal closure, abort cleanup, late completion rejection, and exclusion
from saved events. Raw benchmark output and final screenshots are retained with the task artifacts.

### Final checks and limits

- Bun: 570 passed, one existing skipped test; type checking, lint, and production build passed.
  A final normal production build also passed with the E2E entry disabled.
- Chromium: all 67 exercised regression cases passed across the full run and focused reruns; one
  browser test was skipped by its existing condition. Outdated modal/tab expectations were updated
  to the new user workflows. The final workspace/arrival suite passed all four cases.
- WebKit: the four workspace/arrival cases passed, including all six widths, enlarged text, source
  draft restoration after reloading settings, and three simulation visits. Actor SSE counts returned
  to zero and Worker counts returned to their initial level after each exit. Hidden-tab SSE cleanup
  also passed. Browser WebGL allocations are not directly counted by this fixture; the existing
  Sigma teardown still owns renderer disposal.
- Firefox: the installed Playwright Firefox 155 failed before opening a page with
  `Could not find profile folder`. Retrying with a dedicated temporary directory produced the same
  host launch error. Firefox rendering and behavior therefore remain unverified in this environment.
- Real model generation, remote network jitter, field INP, and GPU memory usage were not measured.
  All execution used fixed fixtures, intercepted APIs, or the deterministic test model.

## Service workspace and action hierarchy (2026-10-01)

Simulation preparation and batch management now live at `/simulations`; source extraction and
scenario review stay at `/document-analysis`. The creation controller remains above these pages.
The management page is lazy-loaded, uses the same compact batch status response, and mounts only
the selected simulation's preparation details. No runtime dependency, graph renderer, message
projection, or model contract was added or changed for this pass.

The existing Button primitive now owns filled primary, tinted secondary, white outlined, and
red-tinted stop actions. Unlayered global border and font resets were overriding its variants;
the border default remains in the base layer, and the font reset now inherits only the family.
Browser checks compare actual computed fills and weights, including a transparent text-action
boundary, rather than just checking CSS class names.

Baseline was commit `ce73dbe`, built in an isolated checkout with the same installed packages.
Both hosts used a production build with the E2E entry enabled, deterministic model support,
Chromium at 1440 × 1000, and reduced motion. The workspace benchmark warms up once and alternates
five measured fresh contexts; each opens and closes settings five times. Both revisions now use
the Back page action. Fixed simulations and interrupted APIs exercised the workflows; real LLM
servers were not contacted.

| Five-run median | Baseline | Service UI |
| --- | ---: | ---: |
| Dashboard ready | 881.47 ms | 881.06 ms |
| First contentful paint | 335.63 ms | 336.41 ms |
| Initial encoded JavaScript | 346,243 bytes | 345,778 bytes |
| Settings click to visible controls | 36.09 ms | 36.71 ms |
| Task CPU, five round trips | 155.35 ms | 152.91 ms |
| Script time | 58.80 ms | 57.05 ms |
| Layout time | 7.56 ms | 7.47 ms |
| Style recalculation | 10.89 ms | 11.04 ms |

Differences are below the 5% remeasurement threshold. These are local workflow measurements,
including Playwright dispatch and control visibility, rather than field INP. Final navigation
labels and accessibility attributes do not add subscriptions or model work.

Validation covered confirmed-scenario handoff, direct URL/reload, selected-run restoration,
source-review return, per-run versus batch cancellation, automatic/manual progression, reports,
settings, and actor-history following. All 571 Bun tests passed, with one existing skipped test;
type checking, lint, and production builds passed. The final affected Chromium suite passed 14
cases, the WebKit workspace/management suite passed seven, and document workflows passed eight
in their focused run. Layout checks covered 320 through 1920 CSS pixels and enlarged text.

Live arrival measured 6.59 ms p95 in Chromium and 14.66 ms in WebKit for twelve fixed messages,
within the 100 ms target. The 4,120-message history mounted twelve cards at its measured position.
Metric-only batches still caused zero round-control, conversation, and stage projection updates.
The 20,000-sample chart fixture retained 158 display points within its 258-point bound. No claim
is made about real model latency, remote network jitter, or GPU memory use. Screenshots and raw
measurement logs are retained with the task's local validation artifacts.

## Generation hierarchy and scoped content (2026-10-02)

Shared scenario and individual world preparation now separate stages, semantic targets, and
target-specific steps. The presentation groups the existing 64-task progress window; it does
not expand retained generation history, change model concurrency, or add runtime dependencies.
One overview stream remains stable while selection changes. Only a selected running step adds
a draft stream; accepted artifacts are requested only when their completed step is selected.
Returning to targets, hiding the page, and leaving the view dispose scoped subscriptions.

A focused browser assertion first reproduced two artifact requests after reopening the same
completed step. Execution/task/attempt-scoped fresh queries reduced this to one request. A new
execution with the same task and attempt fetched its new result, confirming cache isolation.
Measured live stream instances were one for the overview, two with a selected live step, and
zero after leaving the view or hiding it. These are request and lifecycle measurements, not
an overall rendering-speed or real-provider latency claim.

Six pure projection tests cover person/document/rule grouping, world-specific step names,
retry replacement, and incomplete terminal work. Parallel phase progression cannot imply that
a target has finished expanding; the UI labels completion of received steps explicitly.
All 577 Bun tests passed, with one existing skipped test. Type checking, lint, and a normal
production build passed. Across the focused runs, eleven affected Chromium workflows and four
WebKit workflows passed. Browser checks covered target/step navigation, draft replacement,
focus restoration, deferred artifact queries, execution isolation, 320–1920 CSS pixel widths,
200% zoom, and reduced motion. Screenshots and check logs are retained locally under
`output/ui-generation-hierarchy/`. All generation used fixed responses or the test model.
