# Analysis

## Purpose

`analysis` reads one completed `simulation.log.jsonl` file and writes reproducible analysis
artifacts under `analysis/<run_id>/`.

The analyzer is intentionally separate from the simulation workflow. It does not mutate runtime
state, replay the graph, or regenerate LLM outputs. It only reads persisted artifacts.

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

`--run-dir` reads the input JSONL file directly from:

```text
<run-dir>/simulation.log.jsonl
```

`--run-id` keeps the older resolution mode:

```text
<storage.output_dir>/<run_id>/simulation.log.jsonl
```

When `--env` is omitted for `--run-id`, it falls back to the default `./output` location.

## Internal Layout

The implementation is split across `src/simula/application/analysis/`:

| Module area | Responsibility |
| --- | --- |
| `models.py` | typed analyzer records and artifact payloads |
| `interactions.py` | deterministic relationship/thread interaction grouping |
| `loader.py` | JSONL loading, event validation, and normalization |
| `metrics/distributions.py` | role-aware token and latency distributions |
| `metrics/token_usage.py` | cumulative token usage totals overall and by role |
| `metrics/fixer.py` | fixer attribution, retry grouping, and summaries |
| `metrics/network.py` | public orchestration entrypoint for network analysis |
| `metrics/network_aggregation.py` | actor relationship node and edge aggregation |
| `metrics/network_algorithms.py` | NetworkX metric computation, communities, and leaderboards |
| `metrics/network_graph.py` | directed export graph and undirected projection building |
| `plotting/distributions.py` | combined distribution overview rendering |
| `plotting/network.py` | ForceAtlas2-based graph rendering |
| `network_reporting.py` | readable network reference Markdown |
| `summary_reporting.py` | non-specialist top-level summary rendering |
| `token_usage_reporting.py` | deterministic Markdown token summary rendering |
| `artifacts.py` | deterministic JSON, CSV, PNG, and GraphML writing |

`src/simula/application/services/analysis_runner.py` owns orchestration only: settings
resolution, path selection, module ordering, and manifest generation.

## Analysis Pipeline

The current analyzer performs these passes on the loaded run:

1. Load and validate JSONL events, then extract `llm_call`, `actors_finalized`, and
   `round_actions_adopted`.
2. Build overall distributions for `input_tokens`, `output_tokens`,
   `ttft_seconds`, and `duration_seconds`, then render one combined overview plot.
3. Aggregate cumulative `input_tokens`, `output_tokens`, and `total_tokens` overall and by role,
   then persist the totals as JSON, CSV, and Markdown summaries.
4. Attribute `fixer` calls back to the original role by parsing the fixer prompt's
   `Target schema:` line, then aggregate call counts, sessions, retries, TTFT, and duration.
5. Build a directed actor interaction graph from adopted activities using `source_cast_id`,
   `target_cast_ids`, `intent_target_cast_ids`, `visibility`, `thread_id`, and `round_index`,
   then derive global connectivity, hub, authority, influence, brokerage, cohesion, and
   community summaries from NetworkX algorithms.
6. Group adopted activities into deterministic relationship/thread interaction digests so the
   analyzer can surface representative messages without any extra LLM step.
7. Persist one high-level `summary.md` page plus deeper reference artifacts so the output is
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
  distributions/
    overview.png
  token_usage/
    summary.json
    summary.csv
    summary.md
  fixer/
    summary.json
    summary.csv
  network/
    nodes.csv
    edges.csv
    interactions.csv
    summary.json
    summary.md
    graph.graphml
    graph.png
```

`summary.md` is the preferred entry point. It combines the main reading path, key interaction
highlights, token usage summary, and fixer status in one non-specialist document.

`token_usage/summary.json` contains cumulative token totals overall and by role. The matching CSV
and Markdown files make the same totals easy to inspect without manual aggregation from
`llm_calls.csv`.

`network/summary.json` contains the global network metrics, skipped-metric reasons, top actor
leaderboards, and meaningful community groups. `network/summary.md` is now a readable reference
note, while `network/interactions.csv` exposes grouped relationship/thread interactions with
representative and latest messages.

`network/graph.png` keeps the ForceAtlas2 layout because the exported relationship graph is not a
tree/forest in general. A Graphviz `twopi` radial tree layout is technically possible, but it is
not the default because the current interaction graph often contains cycles and cross-links that
would be misleading in a tree view.

`manifest.json` records the analyzed input path, output directory, run metadata, produced files,
fixer summary, token usage summary, and the top-level network summary.

## Failure Policy

- `--run-dir` expects a real run directory path such as `./output/2026-04-14.10`.
- `--run-id` remains available as a compatibility alias.
- The analyzer does not auto-pick the latest run.
- Missing input files, invalid JSONL rows, or logs without any `llm_call` events fail fast.
- Missing `actors_finalized` or `round_actions_adopted` events still produce explicit empty
  network artifacts and record the input gap in the network summary instead of silently skipping
  output generation.
