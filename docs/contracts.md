# Contracts

This document describes the current public data contracts used across server, web, core, and
shared packages.

## Scenario Contract

A scenario contains:

| Field | Meaning |
| --- | --- |
| `sourceName` | optional source file or display name |
| `text` | scenario body with frontmatter removed |
| `controls` | parsed scenario controls |
| `language` | optional prompt language, `en` or `ko` |

Scenario controls:

| Field | Meaning |
| --- | --- |
| `numCast` | required requested cast size |
| `allowAdditionalCast` | whether planning may add more actors |
| `actionsPerType` | generated action count for each visibility type |
| `maxRound` | actor activity round count |
| `fastMode` | enables dependency-safe parallel work inside a run |
| `actorContextTokenBudget` | optional actor context compression budget |

## Settings Contract

`LLMSettings` is a record keyed by model role. Each role maps to `RoleSettings`.

`GET /api/settings` always returns sanitized settings. Secrets are masked as `********`.

`PUT /api/settings` accepts the same shape. Masked secrets retain the previous saved value.

## Run Contract

`RunManifest` contains:

- `id`
- `status`: `created`, `running`, `completed`, or `failed`
- timestamps
- optional scenario name
- optional stop reason or error
- artifact paths

Artifact paths are written relative to the default root shape:

```text
runs/<run_id>/
  manifest.json
  events.jsonl
  state.json
  report.md
  graph.timeline.json
```

`scenario.json` is also written in the run directory so a run can be restarted or inspected with
the original normalized scenario.

## Event Contract

`RunEvent` is the append-only runtime event union written to `events.jsonl` and streamed over SSE.

Current event families include:

- run lifecycle: `run.started`, `run.completed`, `run.failed`
- node lifecycle: `node.started`, `node.completed`, `node.failed`
- model output and metrics: `model.message`, `model.metrics`
- actor and interaction activity: `actors.ready`, `actor.message`, `interaction.recorded`
- round and graph updates: `round.completed`, `graph.delta`
- report and log updates: `report.delta`, `log`

Every event includes `runId` and `timestamp`.

## State Contract

`SimulationState` is the completed structured state written to `state.json`.

It includes the normalized scenario, plan, actor registry, interactions, round digests, round
reports, traces, graph/report-ready values, stop reason, and rendered report Markdown.

The web app treats `state.json` as the structured export for `kind=json`.

## Timeline Contract

`graph.timeline.json` stores an ordered array of `GraphTimelineFrame`.

Frames contain:

- graph nodes with actor label, role, intent, and interaction count
- graph edges with visibility, source, target, weight, round index, and latest content
- active node ids
- messages
- log references

The server appends timeline frames after actor readiness, accepted interactions, and round
completion events.

## Export Contract

`GET /api/runs/:id/export` accepts:

| Kind | File | Content type |
| --- | --- | --- |
| `json` | `state.json` | `application/json` |
| `jsonl` | `events.jsonl` | `application/x-ndjson` |
| `md` | `report.md` | `text/markdown` |

Unsupported export kinds return an explicit `400`.

## Failure Policy

The system prefers explicit failure over silent fallback:

- unsupported scenario controls fail before run creation
- invalid model settings fail when a run starts
- missing provider credentials fail through validation
- failed runs write `run.failed` and persist the manifest error

## Related Docs

- architecture: [`architecture.md`](./architecture.md)
- configuration: [`configuration.md`](./configuration.md)
- workflow stages: [`workflows/README.md`](./workflows/README.md)
