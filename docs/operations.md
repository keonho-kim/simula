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
uv run python analysis.py --run-id 20260413.1
```

If the output directory is resolved through a custom env file:

```bash
uv run python analysis.py --run-id 20260413.1 --env ./env.toml
```

For Korean plot labels on Ubuntu, install the recommended Noto font set:

```bash
./scripts/install_noto_sans_kr_ubuntu.sh
```

## Output Layout

Each run writes to:

```text
output/<run_id>/
  final_report.md
  simulation.log.jsonl
```

The graph returns both artifacts before the presentation layer writes them to disk.

The analyzer writes to:

```text
analysis/<run_id>/
  manifest.json
  llm_calls.csv
  distributions/
  fixer/
  network/
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
- Treat `simulation.log.jsonl` as the runtime-written graph artifact, including raw LLM call events.
- Remove stale prompt assets and workflow docs when stage structure changes.
