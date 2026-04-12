# Operations

## Local Requirements

- Python `>=3.14,<3.15`
- `uv`
- at least one configured LLM provider

## Basic Run Flow

```bash
uv sync
cp env.sample.toml env.toml
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md
```

You can inspect the CLI surface directly with:

```bash
uv run simula --help
```

## CLI Surface

| Flag | Meaning |
| --- | --- |
| `--scenario-file` | read the scenario from a file |
| `--scenario-text` | pass the scenario inline |
| `--env` | explicit config file path |
| `--max-steps` | override the runtime step cap |
| `--trials` | run the same scenario multiple times |
| `--parallel` | execute trials in parallel |

## Common Run Patterns

### Single Run

```bash
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md
```

### Override Step Budget

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --max-steps 12
```

### Repeated Trials

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3
```

### Parallel Trials

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3 \
  --parallel
```

## Config Workflow

- if `--env` is omitted and `env.toml` exists, it is loaded automatically
- effective precedence is:
  - CLI overrides
  - environment variables
  - `env.toml`
  - defaults
- shared provider defaults can be placed under `[llm.<provider>]`
- role-specific routing goes under `[llm.planner]`, `[llm.generator]`,
  `[llm.coordinator]`, `[llm.actor]`, and `[llm.observer]`

## Output and Storage Behavior

### File Outputs

After a successful run, the presentation layer writes:

```text
output/
  <run_id>/
    simulation.log.jsonl
    final_report.md
```

### Multi-Run SQLite Behavior

When `--trials` is greater than `1` and the storage provider is `sqlite`, each trial gets
its own SQLite database file under:

```text
data/db/trial-runs/
```

## Maintenance Commands

### Tests

```bash
uv run pytest
```

### Type Checks

```bash
uv run ty check src
```

### Formatting

```bash
uv run ruff format src tests -v
```

## Operational Notes

- the runtime stops on `max_steps` or on accumulated stagnation after repeated low-momentum
  steps
- deterministic branching can be influenced through `SIM_RNG_SEED` or `[env].rng_seed`
- the removed fixed-time settings `time_unit` and `time_step_size` are rejected on purpose
- file outputs are produced after the workflow returns, not from inside the graph itself
