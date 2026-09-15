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
| `outputLength` | optional LLM response length: `short`, `medium`, or `long` |

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
- accepted scenario artifacts: `board.updated`
- actor and interaction activity: `actors.ready`, `actor.message`, `interaction.recorded`
- round and graph updates: `round.completed`, `graph.delta`
- report and log updates: `report.delta`, `log`

Every event includes `runId` and `timestamp`.

`board.updated` carries typed configuration, digest sections, validated planned events,
action batches, the accepted roster, individual actor start/completion, and actor lifecycle notifications. Unvalidated output previews use the same typed envelope through `GET /api/runs/:id/board-preview?item=:itemId`, but are excluded from persisted events and the general run SSE. Previews carry a stream ID and increasing sequence number; sequence zero resets a field for a new call or retry. New subscriptions receive the current field snapshots, followed by immediate live deltas for that item only. It is emitted
from existing generation results without additional model calls. The browser retains these
artifacts outside its rolling telemetry window and uses them for clickable Scenario Board
items. Progress counts completed work units, not elapsed time: four digest sections, the
event batch, roster, configured actions and actors, and the first round handoff.

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

## Actor History

Actor decisions and interactions can include `thought`, the actor graph's explicit thought-step
output. New interactions carry it alongside the existing action and content fields, so live SSE,
JSONL history, and final state share one message source. This is not provider reasoning telemetry.
Previously stored interactions may omit thought; the UI does not infer it from intent or model logs.


### Portable artifact paths

Manifest `artifactPaths` are relative to the configured run data root (for example,
`<run_id>/report.md`), not to a hardcoded `runs/` directory or a developer's home. The store derives
these paths when reading a manifest, so copied run directories do not retain stale path metadata.
Actual file reads and writes always use the configured data root.


### Action catalog

New plans expose `actionCatalog` as a code-keyed object, replacing the former string list:

```json
{
  "PUB01": {
    "id": "PUB01",
    "visibility": "public",
    "label": "근거 요청",
    "intentHint": "판단에 필요한 정보가 부족할 때",
    "expectedOutcome": "판단을 뒷받침할 자료를 요청한다"
  }
}
```

Codes are assigned by the program and stay unchanged across prompt languages: `PUB`, `GRP`, `PRV`,
and `SOL` followed by an ordinal. Each code has one fixed visibility, preserving the existing
single-choice Actor workflow. Labels, usage conditions, and expected effects use the scenario
language. Generator actors reference the same definitions. `actionsPerType` remains the number of
actions per visibility; its default of three creates twelve definitions.

New action interactions retain the selected code in `actionCode` and its display label in
`actionType`. The backend fills these from the chosen definition; the LLM does not return a label
or metadata object. `no_action` has no action code. UI badges use the generated label directly.
Existing stored labels are not translated or re-generated by this change.
