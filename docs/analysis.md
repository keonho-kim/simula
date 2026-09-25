# Analysis and Inspection

The browser profile owns durable run history in SQLite WASM and OPFS. The Bun server writes
temporary artifacts only while the owning browser session is active. The older integrated
analysis bundle is not written for new runs.

## Current Live Artifacts

The temporary server workspace has this shape while the run is active:

```text
<OS temporary workspace>/<run_id>/
  manifest.json
  scenario.json
  events.jsonl
  state.json
  report.md
  graph.timeline.json
```

Recommended reading order:

1. `manifest.json`
2. `report.md`
3. `graph.timeline.json`
4. `events.jsonl`
5. `state.json`

## Event Stream

Browser SQLite is the source of truth for saved history. The server's temporary `events.jsonl`
feeds the active SSE transport. It records lifecycle events,
model messages, model metrics, actor readiness, accepted interactions, actor messages, graph
deltas, report deltas, logs, and terminal run status.

The browser saves ordered events before projecting them into the UI. Saved events can be exported
from browser storage after the server workspace has disappeared.

## Graph Timeline

`graph.timeline.json` is the replay-oriented view derived from runtime events. The web app uses it
to show actor nodes, interaction edges, active actors, and message history over time.

## Structured State

`state.json` stores the completed simulation state and is exported through
`GET /api/runs/:id/export?kind=json`.

Use it when you need structured actor, interaction, round, report, or trace data rather than the
human-readable report.

## Reference Sample Outputs

`output.samples/` contains committed reference outputs from earlier sample runs. Those directories
may include files such as `report.final.md`, `summary.overview.md`, `simulation.log.jsonl`, `data/`,
`summaries/`, and `assets/`.

Those files are kept for inspection and comparison only. They are not the live output layout for
new runs in the current server.

## Related Docs

- operations: [`operations.md`](./operations.md)
- contracts: [`contracts.md`](./contracts.md)
- architecture: [`architecture.md`](./architecture.md)
