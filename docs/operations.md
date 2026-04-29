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

## Scenario Input

A scenario file must start with frontmatter followed by a non-empty body.

```text
---
num_cast: 6
allow_additional_cast: true
actions_per_type: 3
max_round: 8
fast_mode: false
actor_context_token_budget: 400
output_length: short
---
Scenario body starts here.
```

`num_cast` is required. Other controls are optional and default in code. `output_length` accepts `short`, `medium`, or `long`. Unsupported controls fail
explicitly.

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
