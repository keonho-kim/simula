# Analysis

## Purpose

`analysis` reads one completed `simulation.log.jsonl` file and writes reproducible artifacts under
`analysis/<run_id>/`.

The analyzer is intentionally separate from the simulation workflow. It does not mutate runtime
state, replay the graph, or regenerate LLM outputs. It only reads persisted artifacts and turns
them into deterministic summaries, tables, and plots.

## Entry Point

Run the analyzer with an explicit run directory path:

```bash
uv run analysis --run-dir ./output/2026-04-14.10
```

Legacy `run_id` mode is still available when you want resolution through `storage.output_dir`:

```bash
uv run analysis --run-id 2026-04-14.10 --env ./env.toml
```

For Korean chart rendering on Ubuntu, install the recommended system dependencies first:

```bash
./scripts/install_deps_ubuntu.sh
```

`--run-dir` reads:

```text
<run-dir>/simulation.log.jsonl
```

`--run-id` resolves to:

```text
<storage.output_dir>/<run_id>/simulation.log.jsonl
```

When `--env` is omitted for `--run-id`, it falls back to the default `./output` location.

## Internal Layout

The implementation is split across `src/simula/application/analysis/`:

| Module area | Responsibility |
| --- | --- |
| `models.py` | typed analyzer records and artifact payloads |
| `loader.py` | JSONL loading, event validation, and normalization |
| `metrics/actions.py` | planned-action versus adopted-action summaries |
| `metrics/distributions.py` | role-aware token/latency summaries and performance binning |
| `metrics/token_usage.py` | cumulative token usage totals overall and by role |
| `metrics/fixer.py` | fixer attribution, retry grouping, and summaries |
| `metrics/network.py` | public orchestration entrypoint for final network analysis |
| `metrics/network_growth.py` | cumulative round-by-round network growth metrics |
| `metrics/network_aggregation.py` | actor relationship node and edge aggregation |
| `metrics/network_algorithms.py` | NetworkX metric computation, communities, and leaderboards |
| `metrics/network_graph.py` | directed export graph and undirected projection building |
| `plotting/distributions.py` | performance summary figure rendering |
| `plotting/network.py` | ForceAtlas2 graph rendering, collision resolution, and growth GIF output |
| `plotting/network_metrics.py` | growth and concentration plots |
| `network_reporting.py` | readable network reference Markdown |
| `summary_reporting.py` | non-specialist top-level summary rendering |
| `token_usage_reporting.py` | deterministic Markdown token summary rendering |
| `artifacts.py` | deterministic JSON, CSV, PNG, GIF, and GraphML writing |

`src/simula/application/services/analysis_runner.py` owns orchestration only: settings
resolution, path selection, module ordering, and manifest generation.

## Analysis Pipeline

The current analyzer performs these passes on the loaded run:

1. Load and validate JSONL events, then extract `llm_call`, `plan_finalized`,
   `actors_finalized`, and `round_actions_adopted`.
2. Build overall token/latency summaries for `input_tokens`, `output_tokens`,
   `ttft_seconds`, and `duration_seconds`, then render one combined performance plot.
3. Group calls into `input_tokens x output_tokens` bins with width `1000 x 1000`, then persist
   TTFT and duration `p90/p95/p99` percentiles as a performance CSV summary.
4. Aggregate cumulative `input_tokens`, `output_tokens`, and `total_tokens` overall and by role,
   then persist the totals plus per-call descriptive stats as CSV and Markdown summaries.
5. Attribute `fixer` calls back to the original role by parsing the fixer prompt's
   `Target schema:` line, then aggregate call counts, sessions, retries, TTFT, and duration.
6. Join the execution-plan action catalog with adopted activities so the analyzer can show which
   action options were available, which ones were used, and which ones were never adopted.
7. Build a directed actor interaction graph from adopted activities using `source_cast_id`,
   `target_cast_ids`, `intent_target_cast_ids`, `visibility`, and `round_index`, then derive
   connectivity, influence, brokerage, cohesion, and community summaries from NetworkX.
8. Rebuild the relationship graph cumulatively by round to measure growth, concentration, and
   structural change over time.
9. Render a static network graph and a cumulative growth MP4 with a shared final-graph ForceAtlas2
   layout. The renderer applies deterministic post-layout collision resolution in display space so
   nodes do not overlap in the final output.
10. Persist one high-level `summary.md` page plus deeper reference artifacts so the output remains
   readable without opening several folders first.

KDE curves are computed directly with `numpy`. If a series has fewer than two valid values or is
constant, the analyzer renders the skip reason inside the combined overview figure instead of
inventing a curve.

## Output Layout

Each analyzer run writes:

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

`summary.md` is the preferred entry point. It combines the main reading path, planned-versus-used
actions, network growth, token usage, and fixer status in one non-specialist document.

`actions/summary.csv` compares the planned action catalog against adopted action counts and round
coverage.

`performance/summary.png` is the compact top-level performance figure, while
`performance/summary.csv` groups calls by `input_tokens x output_tokens` bins and records TTFT and
duration `p90/p95/p99` percentiles.

`token_usage/summary.csv` keeps cumulative totals and now also includes per-call descriptive token
stats such as min, max, mean, median, `p90`, `p95`, and `p99`.

`network/growth.csv` contains cumulative round-by-round network metrics. `network/growth_metrics.png`
and `network/concentration.png` make the same information easier to scan visually, while
`network/growth.mp4` shows the graph emerging over time in a pausable video artifact.

`network/summary.json` contains the final global network metrics, skipped-metric reasons, top actor
leaderboards, and meaningful community groups. `network/summary.md` is the human-readable reference
note for the same final and time-series network analysis.

`network/graph.png` keeps the ForceAtlas2 layout because the exported relationship graph is not a
tree or forest in general. Graphviz overlap removal is a valid reference technique, but the
current analyzer keeps the Atlas-style layout and resolves node overlaps with a deterministic
display-space collision pass instead of switching layout engines.

`manifest.json` records the analyzed input path, output directory, run metadata, and the list of
produced files. It is an index, not a duplicate data bundle.

## Failure Policy

- `--run-dir` expects a real run directory path such as `./output/2026-04-14.10`.
- `--run-id` remains available as a compatibility alias.
- The analyzer does not auto-pick the latest run.
- Missing input files, invalid JSONL rows, or logs without any `llm_call` events fail fast.
- Missing `plan_finalized`, `actors_finalized`, or `round_actions_adopted` events remain explicit
  in the derived summaries instead of silently degrading into fabricated outputs.
