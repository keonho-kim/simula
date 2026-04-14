# Analysis

## Purpose

`analysis.py` reads one completed `simulation.log.jsonl` file and writes reproducible analysis
artifacts under `analysis/<run_id>/`.

The analyzer is intentionally separate from the simulation workflow. It does not mutate runtime
state, replay the graph, or regenerate LLM outputs. It only reads persisted artifacts.

## Entry Point

Run the analyzer with an explicit run id:

```bash
uv run python analysis.py --run-id 20260413.1
```

Optional environment file:

```bash
uv run python analysis.py --run-id 20260413.1 --env ./env.toml
```

For Korean chart rendering on Ubuntu, install the recommended font set first:

```bash
./scripts/install_noto_sans_kr_ubuntu.sh
```

The analyzer resolves the input JSONL file from:

```text
<storage.output_dir>/<run_id>/simulation.log.jsonl
```

When `--env` is omitted, it falls back to the default `./output` location.

## Internal Layout

The implementation is split across `src/simula/application/analysis/`:

| Module area | Responsibility |
| --- | --- |
| `models.py` | typed analyzer records and artifact payloads |
| `loader.py` | JSONL loading, event validation, and normalization |
| `metrics/distributions.py` | role-aware token and latency distributions |
| `metrics/fixer.py` | fixer attribution, retry grouping, and summaries |
| `metrics/network.py` | actor relationship node and edge aggregation |
| `plotting/distributions.py` | histogram + KDE rendering |
| `plotting/network.py` | NetworkX-based graph rendering |
| `artifacts.py` | deterministic JSON, CSV, PNG, and GraphML writing |

`src/simula/application/services/analysis_runner.py` owns orchestration only: settings
resolution, path selection, module ordering, and manifest generation.

## Analysis Pipeline

The current analyzer performs four passes on the loaded run:

1. Load and validate JSONL events, then extract `llm_call`, `actors_finalized`, and
   `round_actions_adopted`.
2. Build overall and role-level distributions for `input_tokens`, `output_tokens`,
   `ttft_seconds`, and `duration_seconds`.
3. Attribute `fixer` calls back to the original role by parsing the fixer prompt's
   `Target schema:` line, then aggregate call counts, sessions, retries, TTFT, and duration.
4. Build a directed actor interaction graph from adopted activities using `source_cast_id`,
   `target_cast_ids`, `intent_target_cast_ids`, `visibility`, `thread_id`, and `round_index`.

KDE curves are computed directly with `numpy`. If a series has fewer than two valid values or is
constant, the analyzer records the skip reason instead of silently inventing a curve.

## Output Layout

Each analyzer run writes:

```text
analysis/<run_id>/
  manifest.json
  llm_calls.csv
  distributions/
    overall/
      <metric>.json
      <metric>.png
    roles/
      <role>/
        <metric>.json
        <metric>.png
  fixer/
    summary.json
    summary.csv
  network/
    nodes.csv
    edges.csv
    graph.graphml
    graph.png
```

`manifest.json` records the analyzed input path, output directory, run metadata, produced files,
fixer summary, and network summary.

## Failure Policy

- `--run-id` is required. The analyzer does not auto-pick the latest run.
- Missing input files, invalid JSONL rows, or logs without any `llm_call` events fail fast.
- Empty actor interaction data still produces explicit empty network artifacts instead of
  skipping output generation.
