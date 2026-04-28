# Operations

This document describes language-neutral operating expectations for `simula`: scenario controls,
trial behavior, output layout, and maintenance rules.

## Scenario Input

A scenario is a document with a frontmatter control block followed by the scenario body.

```text
---
num_cast: 6
allow_additional_cast: true
---
Scenario body starts here.
```

The control block accepts:

- `num_cast`: required positive integer
- `allow_additional_cast`: optional boolean

Unsupported controls should fail explicitly. The scenario body should describe the situation,
actors or actor types, stakes, constraints, and pressure that should drive the simulation.

## Repeated Trials

The same scenario may be run more than once to compare behavior across trials.

Operational expectations:

- each trial gets its own run id
- each trial writes its own run directory
- trials should not overwrite each other's structured records
- shared sample runs under `output.samples/` should not be treated as live output

Trial execution order is an implementation detail. Artifact isolation is the product requirement.

## Output Layout

Each completed simulation run writes one run directory:

```text
output/
  <run_id>/
    manifest.json
    report.final.md
    summary.overview.md
    simulation.log.jsonl
    data/
    summaries/
    assets/
```

Use the paths as follows:

| Path | Meaning |
| --- | --- |
| `output/` | live run output written by local execution |
| `output.samples/` | committed reference runs kept for inspection |
| `simulation.log.jsonl` | source event stream for inspection and analysis |
| `report.final.md` | final human-readable report |
| `summary.overview.md` | compact analysis entrypoint |
| `data/` | tabular and structured analysis exports |
| `summaries/` | human-readable analysis summaries |
| `assets/` | rendered analysis visuals |

## Run Manifest

`manifest.json` should make a saved run self-describing.

It should include:

- run id
- status
- timestamps
- scenario metadata
- effective configuration summary with secrets redacted
- artifact paths
- event count
- model-call count
- observed roles
- failure text when a run fails

## Maintenance Notes

- Keep documentation aligned with product behavior and artifact contracts.
- Keep `simulation.log.jsonl` as the source artifact for analysis.
- Keep final reports tied to completed runtime traces.
- Update workflow docs when stage responsibilities or handoffs change.
- Do not document language-specific setup here until the runtime transition has a stable target
  surface.

## Related Docs

- configuration concepts: [`configuration.md`](./configuration.md)
- analysis artifacts: [`analysis.md`](./analysis.md)
- workflow stages: [`workflows/README.md`](./workflows/README.md)
