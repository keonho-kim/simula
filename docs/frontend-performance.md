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
| `src/ui/components/simulation/interlude/` | Stage-progress overlay presentation. |

Graph, actor rail, stage, and metric panel boundaries are memoized. Message cards receive stable
primitive props, so an appended interaction does not re-render unchanged cards. Graph camera
updates do not trigger React overlay updates when no actor is selected. Actor text replacement
patterns are prepared once for a batch instead of once per field per message.

Retained event identity indexes belong to the store's run lifecycle and are cleared on reset.
Duplicate history updates preserve collection references. Conversation subscribers receive only
actor readiness and recorded interactions; metric/reasoning traffic does not invalidate them.
Stage events exclude metric/reasoning/log/chart/report payloads that its models do not consume.

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
Vite emits a separate worker asset in the production build.

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
2. **Virtual actor history.** `components/actors/history/virtual-history.tsx` uses TanStack Virtual
   with measured variable heights, overscan, stable keys, and end anchoring inside the existing
   ScrollArea. Reading above the end pauses following; reaching the end resumes it with a one-pixel
   tolerance. Width changes invalidate measured heights, and a focused row remains mounted. The
   component opts out of React Compiler memoization and keeps the mutable virtualizer local.
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
without count-up animation. Repeating pulses/spinners, hover lifts, zoom/slide entrances, and
backdrop filters are removed; dialogs retain a short opacity fade. The report chart also computes
its vertical scale once per series instead of rescanning every sample for every point.

`storage/run-session.ts` keeps only the active run id, view, auto-continue preference, and handled
round numbers in tab-scoped session storage. Reloading reconnects to server events and restores the
simulation/report view. A continuation is not persisted as handled while its HTTP request is still
pending. This restores a browser view, not a stopped server process. The original external trigger
for a user's unexpected reload cannot be established from client source alone; defaulting every
remount to the home page was independently reproduced and corrected.

A browser workflow reloads during automatic progression with 6x CPU throttling and reduced motion,
then verifies that the simulation resumes and only two continuation requests advance three rounds.

Production builds use Vite's dependency-aware chunking. The prior forced vendor partition caused
an initialization-order error in the built browser app; removing that override was verified in a
source-free deployment using the built API server and browser workflows.
