# Analysis and Inspection

The browser profile owns durable run history in SQLite WASM and OPFS. The Next.js/Node server writes
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

## Outcome-focused analytical reports

New reports contain key outcomes, turning points, actor reactions and interests, influential
conditions, material improvements and checks, and an integrated conclusion. Batch reports
add recurring and rare development paths, with observed world counts and unclassified worlds.
A single run does not generate a distribution. Counts are observations, not estimated real-world
probabilities. Prompt instructions separate requested, promised, and performed actions, distinguish
temporal succession from causation, and avoid asserting untested alternatives as effective.

Evidence reduction precedes interpretation. Fast Mode permits independent reductions and
interpretation branches under the existing model admission limit. LangGraph retains compact
references and accepted fields; models return bounded prose and finite choices, while code
assembles the report. No new JSON output requirement or scoring call is introduced.

The result page opens the full conclusion in an editorial reading workspace. Analysis, records,
and execution details are separate views. A contents rail selects one chapter; only that chapter
mounts. On compact screens the contents collapse above the prose. Scope and on-demand source
excerpts share an adjacent column on wide screens. Opening evidence preserves the reading position,
and closing it restores focus to the source control.

Standalone runs retain relationship, conversation, and archived-commentary views under Records.
Batch runs resolve to their aggregate report and omit single-world result panels. Active sibling
worlds block generation with an explicit waiting screen. Model charts and accounting load only in
Execution details; preparation offers a separate disclosure. Existing stored SWOT reports retain
their original section identities and exported score metadata.

Deterministic tests cover single and batch section layouts, local retry, accepted evidence
provenance, exported reports, archived schemas, and board rendering. Browser test sources
cover card navigation and setup world-count retention; browser execution remains user-run.

Conclusion generation retains six bounded text calls. Source interpretation and observed
development can proceed independently in Fast Mode; integrated judgment waits for both and
uses bounded section-detail excerpts. Each final part requests multiple substantive paragraphs
without inventing facts to meet a length target. Stored reports show their existing full text
immediately and are not silently regenerated. Prompt improvements apply to subsequent generation.
