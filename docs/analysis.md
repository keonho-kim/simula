# Analysis

## Purpose

`analysis` reads one completed `simulation.log.jsonl` artifact and writes deterministic summaries,
tables, and plots under `analysis/<run_id>/`.

The analyzer is intentionally separate from the simulation workflow:

- it does not replay the graph
- it does not regenerate LLM outputs
- it does not mutate runtime state
- it only reads persisted artifacts and derives secondary outputs

## Input Selection

Run the analyzer with an explicit run directory:

```bash
uv run analysis --run-dir ./output/2026-04-14.10
```

Or use the compatibility selector by `run_id`:

```bash
uv run analysis --run-id 2026-04-14.10 --env ./env.toml
```

Input resolution rules:

- `--run-dir` expects a real run directory and reads `<run-dir>/simulation.log.jsonl`
- `--run-id` resolves `<storage.output_dir>/<run_id>/simulation.log.jsonl`
- when `--env` is omitted for `--run-id`, the analyzer falls back to the default `./output`
- the expected `run_id` is validated against every JSONL row

The analyzer does not auto-pick the latest run.

## Output Location

Analyzer output is always written to:

```text
analysis/<run_id>/
```

This location is not derived from `storage.output_dir`. It is a separate analysis workspace rooted
at the current working directory.

## Internal Layout

The implementation is split across `src/simula/application/analysis/`:

| Module area | Responsibility |
| --- | --- |
| `loader.py` | JSONL loading, row validation, event normalization |
| `models.py` | typed records and manifest payloads |
| `metrics/actions.py` | planned-versus-adopted action summaries |
| `metrics/distributions.py` | token and latency distributions |
| `metrics/token_usage.py` | cumulative token accounting |
| `metrics/fixer.py` | fixer attribution and retry summaries |
| `metrics/network.py` | top-level network analysis orchestration and benchmark summaries |
| `metrics/network_growth.py` | cumulative round-by-round network growth |
| `metrics/network_aggregation.py` | node and edge aggregation from adopted activities |
| `metrics/network_algorithms.py` | NetworkX metrics, leaderboards, and communities |
| `metrics/network_graph.py` | export graph and projection building |
| `plotting/distributions.py` | performance overview figure rendering |
| `plotting/network.py` | static network rendering and growth video rendering |
| `plotting/network_metrics.py` | growth and concentration plots |
| `summary_reporting.py` | human-readable summary page |
| `network_reporting.py` | network reference markdown |
| `token_usage_reporting.py` | token summary markdown |
| `artifacts.py` | deterministic JSON, CSV, image, and GraphML writing |

`src/simula/application/services/analysis_runner.py` owns orchestration only: input resolution,
module ordering, output recording, and manifest generation.

## Pipeline

The current analyzer performs these passes:

1. Load and validate JSONL rows, then extract the events relevant to analysis.
2. Persist one `llm_calls.csv` table containing raw LLM-call level records.
3. Build token and latency distributions for `input_tokens`, `output_tokens`,
   `ttft_seconds`, and `duration_seconds`, then render a single performance overview image.
4. Group calls into `input_tokens x output_tokens` bins and compute TTFT and duration
   `p90`, `p95`, and `p99` percentiles for `performance/summary.csv`.
5. Attribute fixer calls back to the repaired role and summarize retries, sessions, and timing.
6. Aggregate cumulative token usage overall and by role, then render CSV and Markdown summaries.
7. Compare the execution plan's action catalog with adopted activities to show available,
   used, and unused action types.
8. Build an actor interaction graph from adopted activities, then derive connectivity,
   concentration, leaderboards, community structure, and benchmark-oriented structure metrics
   from NetworkX and deterministic helper functions.
9. Rebuild the same relationship graph cumulatively by round to measure network growth,
   concentration, path depth, and structural change over time.
10. Render one high-level `summary.md` page plus deeper reference artifacts.

KDE curves are computed locally. When a series is too short or constant, the renderer writes the
skip reason into the figure instead of inventing a curve.

## Artifact Guide

The analyzer may produce:

```text
analysis/<run_id>/
  summary.md
  manifest.json
  llm_calls.csv
  actions/
    summary.csv
  performance/
    summary.png
    summary.csv
  token_usage/
    summary.csv
    summary.md
  fixer/
    summary.csv
  network/
    nodes.csv
    edges.csv
    growth.csv
    summary.json
    summary.md
    graph.graphml
    graph.png
    growth_metrics.png
    concentration.png
    growth.mp4
```

Artifact notes:

- `summary.md` is the preferred human entrypoint.
- `manifest.json` is an index of what was analyzed and what was written.
- `llm_calls.csv` stays close to the raw runtime evidence.
- `performance/summary.png` is the compact overview chart.
- `performance/summary.csv` stores TTFT and duration percentiles by `input_tokens x output_tokens`
  bins.
- `token_usage/summary.md` is the readable token summary.
- `token_usage/summary.csv` includes cumulative totals plus descriptive token statistics.
- `actions/summary.csv` compares planned action types against adopted usage and round coverage.
- `network/growth.csv` includes cumulative growth metrics such as density, average path depth,
  edge growth rate, and top-20-percent interaction share.
- `network/summary.md` is the readable network reference note.
- `network/summary.json` includes `summary`, `benchmark_metrics`, leaderboards, communities, and
  explicit skipped-metric reasons.
- `network/graph.png` keeps the ForceAtlas2 layout and uses deterministic collision cleanup rather
  than switching layout engines.
- localized CSV headers and plot titles are intentionally written in Korean by the analyzer's
  localization layer.

## Benchmark Metric Basis

The benchmark metrics use fixed comparison rules so runs remain comparable:

- participation entropy normalizes actor activity share by the full finalized actor roster size
- action-type diversity uses the planned action catalog size when available, otherwise the observed
  action-type count
- density and path depth are computed on the directed interaction graph
- average path depth and diameter only use reachable ordered node pairs instead of assuming strong
  connectivity
- communities and modularity use the weighted undirected projection built from the directed graph
- mean edge growth rate and mean active-actor growth rate average cumulative round deltas from
  round 2 through the final round

When a metric cannot be computed, the analyzer stores `None` in the metric field and records the
explicit reason under `summary.skipped_metrics` instead of silently substituting a fallback value.

## Failure Policy

- missing input files fail fast
- invalid JSONL rows fail fast
- logs without any `llm_call` events fail fast
- missing `plan_finalized`, `actors_finalized`, or `round_actions_adopted` evidence remains
  explicit in the derived summaries instead of silently fabricating outputs

## Related Docs

- run and output operations: [`operations.md`](./operations.md)
- runtime artifact contracts: [`contracts.md`](./contracts.md)
