# Operations

## Local Development

Install dependencies:

```bash
bun install
```

Run the server and web app in separate terminals:

```bash
bun run dev:server
bun run dev:web
```

Or run both:

```bash
bun run dev
```

The server defaults to `http://localhost:3001`. The web app proxies `/api` to that server.

## Built Application

From the repository root:

```bash
bun run build
bun run start
```

The root build runs `build:server` and `build:web` in parallel and fails if either build fails.
Backend output is `dist/backend/index.js` (Bun target, external packages); frontend output is
`apps/web/dist`, including the separate graph layout Worker. Keep the checkout's package files,
installed dependencies, sample directory, and build outputs together when running the application.

`start` sets production mode and serves both the API and built web app through the Bun server.
The default URL is `http://localhost:3001`; `PORT` applies to both. No Vite process or development
proxy is needed. Settings and run data use the same repository-root resolution as development.
Hashed assets are cached as immutable; HTML is revalidated. Unknown assets return 404. Missing web
build output is an explicit startup error. Rebuild after changing application source.

## Scenario Input

A scenario file must start with frontmatter followed by a non-empty body.

```text
---
num_cast: 6
allow_additional_cast: true
actions_per_type: 3
max_round: 8
autonomous_progress: false
fast_mode: false
output_length: short
---
Scenario body starts here.
```

`num_cast` is required. Other controls are optional and default in code. `output_length` accepts
`short`, `medium`, or `long` and also controls actor memory compression length. Unsupported controls
fail explicitly.

Sample scenarios live in [`../senario.samples/`](../senario.samples/README.md).

## Run Lifecycle

The web app normally drives runs:

1. create or load a scenario
2. review scenario controls
3. save role settings
4. create a run with `POST /api/runs`
5. start it with `POST /api/runs/:id/start`
6. stream updates from `GET /api/runs/:id/events`
7. inspect or export the report after completion

The server prevents starting the same run twice in the same process. A second start request for an
already running run returns `already_running`.

## Run Artifacts

Default live output:

```text
runs/<run_id>/
  manifest.json
  scenario.json
  events.jsonl
  state.json
  report.md
  graph.timeline.json
```

Override the live root with `SIMULA_DATA_DIR`.

| File | Purpose |
| --- | --- |
| `manifest.json` | run id, status, timestamps, stop reason, error, and artifact paths |
| `scenario.json` | normalized scenario used by the run |
| `events.jsonl` | append-only runtime events |
| `state.json` | completed structured simulation state |
| `report.md` | final human-readable report |
| `graph.timeline.json` | replay frames for graph and message inspection |

## Exports

Use the export endpoint for completed runs:

| Query | Output |
| --- | --- |
| `kind=json` | `state.json` |
| `kind=jsonl` | `events.jsonl` |
| `kind=md` | `report.md` |

Unsupported kinds fail with `400`.

## Validation Commands

Run these from the repository root:

```bash
bun test
bun run typecheck
bun run lint
bun run build
```

Browser smoke tests:

```bash
bun run test:e2e
```

## Maintenance Notes

- Keep `runs/` ignored; it is local runtime state.
- Keep `output.samples/` as committed reference data only.
- Update workflow docs when stage order or run event behavior changes.
- Update `packages/shared` types and this documentation together when public event or API shapes change.

## Dependency Update Constraints

Direct dependencies were checked against npm stable releases on 2026-09-15. Root and web
workspace declarations use matching versions, with `bun.lock` recording resolved packages.

Two dependencies intentionally remain on the newest compatible release line:

- TypeScript 6.0.3: typescript-eslint 8.70.0 supports `>=4.8.4 <6.1.0`, so TypeScript 7.0.2
  is outside its supported range. See the [supported dependency versions](https://typescript-eslint.io/users/dependency-versions/).
- KaTeX 0.16.47: rehype-katex 7.0.1 depends on `katex ^0.16.0`. Keep the directly imported
  stylesheet on the renderer's version line rather than mixing it with KaTeX 0.18 assets.

Recheck these constraints before a future upgrade. `bun outdated --recursive` lists both
packages as newer upstream releases; this does not mean their current integration supports them.


## Automatic round progression

The first three consecutive successful automatic round approvals each show the five-second
countdown. Subsequent rounds in that streak continue immediately without opening the round
modal. The simulation header retains an auto-continue switch so this mode can be stopped.
Turning auto-continue off, a failed continuation, or selecting/creating another run resets the
streak. The tab session retains the confirmed streak across reloads, together with acknowledged
rounds. Manual approvals do not advance the automatic streak.
