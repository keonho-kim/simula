# Analysis and Inspection

The current TypeScript implementation writes live run artifacts under `runs/`. It does not write
the older integrated analysis bundle for new runs.

## Current Live Artifacts

For each run, inspect:

```text
runs/<run_id>/
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

`events.jsonl` is the main source of truth for runtime inspection. It records lifecycle events,
model messages, model metrics, actor readiness, accepted interactions, actor messages, graph
deltas, report deltas, logs, and terminal run status.

Because the file is newline-delimited JSON, it can be streamed during a run and exported afterward
through `GET /api/runs/:id/export?kind=jsonl`.

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
