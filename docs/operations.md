# Operations

## Local Run

Typical local setup:

```bash
uv sync
cp env.sample.toml env.toml
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md
```

To increase console logging without changing persisted artifacts:

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --log-level DEBUG
```

You can also pass the scenario inline:

```bash
uv run simula --scenario-text "$(cat ./senario.samples/03_startup_boardroom_crisis.md)"
```

Both `--scenario-file` and `--scenario-text` must provide the full scenario document, including
YAML frontmatter. The parser requires:

- a frontmatter block at the top of the document
- flat `key: value` lines only
- `num_cast`
- optional `allow_additional_cast`
- no unsupported keys

Example:

```text
---
num_cast: 6
allow_additional_cast: true
---
Scenario body starts here.
```

## Repeated Trials

The simulator can run the same scenario multiple times.

Sequential trials:

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3
```

Parallel trials:

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3 \
  --parallel
```

Operational notes:

- `--trials` must be `>= 1`
- `--parallel` only changes execution strategy when `--trials > 1`
- for SQLite storage, repeated trials rewrite the SQLite database path to sibling files under a
  `trial-runs/` directory so trials do not share one runtime database
- the file output root still comes from `storage.output_dir`

## Analyze One Saved Run

Analyze a run from its directory:

```bash
uv run analysis --run-dir ./output/2026-04-14.10
```

Compatibility selector by `run_id`:

```bash
uv run analysis --run-id 2026-04-14.10 --env ./env.toml
```

Resolution rules:

- `--run-dir` reads `<run-dir>/simulation.log.jsonl`
- `--run-id` resolves `<storage.output_dir>/<run_id>/simulation.log.jsonl`
- when `--env` is omitted for `--run-id`, the analyzer falls back to the default `./output`

For Korean plot labels on Ubuntu, install the recommended system packages first:

```bash
./scripts/install_deps_ubuntu.sh
```

## Output Layout

Each completed simulation run writes:

```text
<storage.output_dir>/<run_id>/
  final_report.md
  simulation.log.jsonl
```

The responsibilities are split deliberately:

- `RunJsonlAppender` writes `simulation.log.jsonl` incrementally during execution
- the workflow builds structured report payloads and markdown text in memory
- the executor reads the completed JSONL file back into `simulation_log_jsonl`
- the presentation layer writes `final_report.md`

The analyzer always writes to a local analysis directory rooted at the current working directory:

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

Some analyzer artifacts are conditional:

- `actions/summary.csv` is written only when there are action rows to report
- `network/growth.csv` is written only when growth rows exist
- `network/growth.mp4` is recorded only when video rendering produces a file

## Storage Bootstrap

For PostgreSQL-backed runs, initialize storage explicitly when the schema or checkpoint tables do
not already exist:

```bash
uv run python -m simula.infrastructure.storage.schema_bootstrap --env ./env.toml
```

## Validation Commands

Run the full local validation set after behavior changes:

```bash
uv run pytest -q
uv run ty check src
uv run ruff check src tests
uv run ruff clean
```

Use formatting only when you actually need a formatting rewrite:

```bash
uv run ruff format src tests
uv run ruff clean
```

## Maintenance Notes

- Keep docs aligned with the compiled graph, not with stale prompt drafts or deleted modules.
- Treat `simulation.log.jsonl` as the source artifact for analysis, not as a derived export.
- Treat `analysis/<run_id>/summary.md` as the default human-readable entrypoint for analyzer output.
- Update the workflow docs when active node names, branch points, or stage outputs change.
