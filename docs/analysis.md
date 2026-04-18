# Analysis

Derived analysis is no longer a separate CLI or a separate `analysis/<run_id>/` workspace.
Instead, every successful simulation run writes analysis artifacts into the same run directory
that already contains `simulation.log.jsonl`.

## Source of Truth

The analysis pipeline still uses `simulation.log.jsonl` as its only durable input.

- `simulation.log.jsonl` is written incrementally during execution.
- after the workflow completes, the integrated output writer reloads that JSONL file
- the derived metrics, tables, plots, and summary markdown are written beside it

## Output Layout

Each run directory now follows this shape:

```text
<storage.output_dir>/<run_id>/
  simulation.log.jsonl
  manifest.json
  report.final.md
  summary.overview.md
  data/
    llm_calls.csv
    performance.summary.csv
    fixer.summary.csv
    token_usage.summary.csv
    actions.summary.csv
    network.nodes.csv
    network.edges.csv
    network.growth.csv
    network.summary.json
  summaries/
    token_usage.summary.md
    network.summary.md
  assets/
    performance.summary.png
    network.graph.png
    network.graph.graphml
    network.growth_metrics.png
    network.concentration.png
    network.growth.mp4
```

## Run Metadata

`manifest.json` is the only manifest file.

It includes:

- run identity and status
- start and end timestamps
- wall-clock runtime
- scenario file metadata
- actor model id
- redacted settings snapshot
- produced artifact paths
- analysis summary metadata such as event count, llm call count, and roles
- error text for failed runs

Failed runs still keep `simulation.log.jsonl` and `manifest.json`, but they do not write derived
analysis artifacts unless those artifacts were actually completed.

## Implementation Notes

The analysis computation still lives under `src/simula/application/analysis/`.

- `loader.py` validates and loads JSONL rows
- `metrics/*` computes reports
- `plotting/*` renders visual artifacts
- `runner/bundle.py` assembles the computed report bundle
- `runner/writing.py` writes the integrated analysis files into the run directory

The removed pieces are the standalone analyzer entrypoint and standalone input-resolution flow.
