# Simula Web

`apps/web` retains browser tests and benchmarks. Next.js serves production UI from `src/app`
and `src/ui`, providing the local command surface for:

- editing or loading scenarios
- drafting scenarios with Story Builder
- configuring role-based model settings
- starting simulation runs
- viewing live actor activity and graph replay
- reading and exporting completed reports

## Development

Run the single web and API server from the repository root:

```bash
bun run dev
```

The Next custom server serves pages and `/api` from one HTTPS origin.

## App Structure

Production source lives in `src/ui` and is organized by responsibility:

| Path | Purpose |
| --- | --- |
| `src/ui/shell` | application composition, view selection and workflow wiring |
| `src/ui/pages` | start and report page composition |
| `src/ui/components` | components grouped by scenario, settings, activity, actors, graph and other UI responsibilities |
| `src/ui/components/ui` | shadcn primitives |
| `src/ui/hooks` | locale and run-event React lifecycles |
| `src/ui/stores` | cross-cutting Zustand state and event projections |
| `src/ui/types` | browser contracts shared across modules |
| `src/ui/models` | presentation calculations, round prompts and settings form transformations |
| `src/ui/api-client` | HTTP client and export download operations |
| `src/ui/browser-storage` | language preference and provider-model browser cache |
| `src/ui/i18n` | English/Korean dictionaries and locale resolution |
| `src/ui/lib` | class-name utility |

Components may keep private helpers and types locally. Models, types and stores do not import
pages or components. Browser code uses `src/shared` contracts and never imports backend modules.

The UI uses React, Tailwind CSS v4, shadcn/ui components, TanStack Query, Zustand, lucide icons,
graphology, and Sigma.

## API Assumptions

The client expects the server routes documented in the root README:

- `/api/settings`
- `/api/story-builder/draft`
- `/api/scenarios/samples`
- `/api/runs`
- `/api/runs/:id/events`
- `/api/runs/:id/report`
- `/api/runs/:id/export`

Run events are streamed through Server-Sent Events. The client subscribes to the known `RunEvent`
types and batches live state updates with `requestAnimationFrame`.

## Localization

The client supports English and Korean UI text. The selected prompt language is also passed into
scenario creation and Story Builder requests so model-facing natural language follows the chosen
locale while machine-readable tokens remain unchanged.

## Validation

From the repository root:

```bash
bun run typecheck
bun run lint
bun run build
```

End-to-end smoke tests are configured at the repository root:

```bash
bun run test:e2e
```

## Naming and Local Helpers

- `components/graph/graph-view.tsx` renders the graph. `node-degree.ts` calculates connectivity; renderer helpers stay with the graph component.
- `components/settings/*-settings-panel.tsx` renders sections inside the settings dialog. Full-page composition belongs in `pages/`.
- `models/settings/draft-updates.ts` updates form drafts; `settings-options.ts` owns available options, defaults, and capability checks.
- `components/report/presentation.tsx` contains report-specific presentation elements and formatting.
- `browser-storage/provider-model-cache.ts` owns the browser provider-model cache.
- `i18n/messages/` contains translation data, not executable scripts.
- `lib/class-names.ts` contains the generic `cn` utility; the shadcn utils alias points here.

Use explicit implementation filenames. Reserve `index.ts` for intentional module exports. Keep feature-specific helpers with their feature rather than collecting them in a generic utils directory. Pure functions and component helpers do not require separate files solely because their implementation style differs.

## Actor History Rail

The simulation view uses a 60:40 graph/history split at desktop widths and stacks the panels
on smaller screens. `components/actors/actor-rail.tsx` renders one tail-free card per recorded
interaction under a `ROUND K` divider. Thought text is muted gray; action and speech text is black.
Actor names are borderless text buttons that open the existing actor detail dialog. Replay controls appear only on the report page, not below the live simulation.

`models/actors/actor-conversation.ts` groups the durable `interaction.recorded` events by round.
It does not render the duplicate `actor.message` event or provider reasoning traces as another
message. The rail uses retained actor events rather than the capped diagnostic log, and limits
history to the selected replay frame when replaying earlier activity. New entries scroll into
view while the reader is at the bottom. Scrolling upward pauses automatic following, including
small upward movements. Reaching the bottom again resumes it; a one-pixel tolerance accounts
for fractional browser scroll positions.

The actor graph copies its explicit `thought` output into the decision and recorded interaction.
Older artifacts without this field show the recorded action and speech without inventing thought
text. The former role-signal ActivityRail has been removed; report role diagnostics remain available.

Verify the workflow with `bun run test:e2e actor-rail.e2e.ts`. Browser tests use the local deterministic
test model and isolated settings, not paid provider API calls.

## Round Confirmation

Every nonterminal completed round opens `components/simulation/round-continuation-dialog.tsx`.
With automatic progression enabled, the dialog counts down for five seconds before closing and
requesting the next round. Turning automatic progression off cancels the timer and exposes the
manual Continue button. Turning it back on starts a fresh five-second countdown. Stopping the run
or unmounting the dialog clears the timer. A failed continuation returns to manual confirmation.

The countdown belongs to the mounted run/round dialog, so incoming event updates do not restart it.
The final round still proceeds directly to the completed-report prompt. Verify automatic timing,
cancellation, and manual progression with `bun run test:e2e round-continuation.e2e.ts`.

## Rendering Performance

Rendering, model calculations, event collections, and WebGL lifecycle code have separate owners.
See [frontend performance](../../docs/frontend-performance.md) for the module map, benchmark
command, measurements, and preserved behavior.
