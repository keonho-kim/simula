# Operations

## Local Run

```bash
uv sync
cp env.sample.toml env.toml
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md
```

You can also provide scenario text inline through the CLI entrypoint if needed.

To inspect detailed local workflow and LLM logs without changing persisted artifacts:

```bash
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md --log-level DEBUG
```

## Analyze One Saved Run

After a run finishes, inspect its saved JSONL artifact with:

```bash
uv run analysis --run-dir ./output/2026-04-14.10
```

If you prefer the legacy `run_id` selector resolved through a custom env file:

```bash
uv run analysis --run-id 2026-04-14.10 --env ./env.toml
```

For Korean plot labels on Ubuntu, install the recommended system dependencies first:

```bash
./scripts/install_deps_ubuntu.sh
```

## Output Layout

Each run writes to:

```text
output/<run_id>/
  final_report.md
  simulation.log.jsonl
```

The workflow produces the report payloads, while the executor fills `simulation_log_jsonl`
from the append-driven runtime log before the presentation layer writes files.

The analyzer writes to:

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

## Validation Commands

Run the full local validation set after behavior changes:

```bash
uv run pytest -q
uv run ty check src
uv run ruff check src tests
uv run ruff clean
```

Use `uv run ruff format src tests` only when formatting changes are actually needed.

## Configuration Flow

Settings resolve in this order:

1. built-in defaults
2. `env.toml`
3. environment variables
4. CLI overrides

Important runtime controls:

- `runtime.max_rounds`
- `runtime.max_actor_calls_per_step`
- `runtime.max_focus_slices_per_step`
- `runtime.max_recipients_per_message`
- `runtime.enable_checkpointing`
- `runtime.rng_seed`

## Maintenance Notes

- Keep documentation aligned with the compiled graph, not historical files.
- Treat `simulation.log.jsonl` as the append-driven runtime artifact and source of truth for analysis.
- Treat `analysis/<run_id>/summary.md` as the default human-readable entrypoint for analyzer output.
- Remove stale prompt assets and workflow docs when stage structure changes.
