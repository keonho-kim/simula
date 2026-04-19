<p align="center">
  <h1>Simula</h1>
</p>

<p align="center">
  <img alt="Python 3.13" src="https://img.shields.io/badge/python-3.13-blue">
  <img alt="Package manager uv" src="https://img.shields.io/badge/package_manager-uv-4B8BBE">
  <img alt="Runtime LangGraph" src="https://img.shields.io/badge/runtime-LangGraph-1f6feb">
  <img alt="Architecture staged" src="https://img.shields.io/badge/architecture-staged-0f766e">
</p>

`simula` is a scenario-to-report simulation engine built on LangGraph. It takes one scenario
file, runs a staged multi-agent simulation, and writes one inspectable run directory with the
final Markdown report, `simulation.log.jsonl`, and derived analysis artifacts.

[Documentation](./docs/README.md) · [Workflow Docs](./docs/workflows/README.md) · [Sample Scenarios](./senario.samples/README.md)

## What It Does

`simula` keeps planning, actor generation, runtime rounds, and report writing as separate stages.

- Planning turns raw scenario text into one compact analysis bundle and one execution-plan bundle.
- Generation turns the cast roster into actor cards through explicit slot-by-slot generation.
- Runtime loops through directed rounds instead of free-running until token exhaustion.
- Finalization turns the finished state into a report bundle and a JSONL log.

The result is easier to inspect, test, and extend than a single opaque generation loop.

The integrated analysis pipeline also exposes benchmark-friendly network metrics so saved runs can be compared on
participation spread, action diversity, path depth, concentration, community structure, and
cumulative growth.

Shared logging and runtime-output helpers live under `simula.shared.*`.

## Why This Design

- Small public API: the root graph accepts a compact input and returns a compact output.
- Staged execution: planning, generation, runtime, and finalization are independent steps.
- Durable artifacts: each successful run leaves a report, a JSONL log, and analysis files.
- Inspectable runs: saved outputs can be compared across models and repeated trials.

## Quick Start

```bash
uv sync
cp env.sample.toml env.toml
# UPDATE YOUR ENV.TOML
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md
```

For detailed local workflow logs:

```bash
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md --log-level DEBUG
```

Repeat the same scenario three times:

```bash
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md --trials 3
```

Allow intra-run graph parallelism for one run:

```bash
uv run simula --scenario-file ./senario.samples/03_startup_boardroom_crisis.md --parallel
```

Outputs land in:

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

Committed sample outputs live in:

```text
output.samples/
  <run_id>/
    manifest.json
    report.final.md
    summary.overview.md
    simulation.log.jsonl
    data/
    summaries/
    assets/
```

Run ids follow:

```text
YYYYMMDD.001.<actor-model-id>.<scenario-file-stem>
```

For example:

```text
20260418.001.qwen3-8b.03-startup-boardroom-crisis
```

The integrated analysis artifacts land in the same run directory:

```text
output/
  <run_id>/
    data/llm_calls.csv
    data/performance.summary.csv
    summaries/token_usage.summary.md
    summaries/network.summary.md
    assets/network.graph.png
    assets/network.growth.mp4
```

The repository keeps example saved runs under [`output.samples/`](./output.samples/).
Treat `output/` as the live runtime output root and `output.samples/` as committed reference data.

## One End-to-End Flow

```mermaid
flowchart LR
    Scenario["Scenario file"] --> CLI["CLI / bootstrap"]
    CLI --> Executor["SimulationExecutor"]
    Executor --> Input["SimulationInputState"]
    Input --> Hydrate["hydrate_initial_state"]
    Hydrate --> Planning["planning"]
    Planning --> Generation["generation"]
    Generation --> Runtime["runtime"]
    Runtime --> Finalization["finalization"]
    Finalization --> Output["SimulationOutputState"]
    Output --> Report["report.final.md"]
    Output --> Log["simulation.log.jsonl"]
```

This is the only flow described by the current documentation set.

## Workflow Stages

| Stage | Active path | Output |
| --- | --- | --- |
| `planning` | `build_planning_analysis -> build_execution_plan -> finalize_plan` | compact execution plan |
| `generation` | `prepare_actor_slots -> generate_actor_slot -> finalize_generated_actors` | actor cards |
| `runtime` | `initialize_runtime_state -> prepare_round -> plan_round -> actor proposal stage -> resolve_round` | adopted activities, observer reports, stop state |
| `finalization` | `resolve_timeline_anchor -> build_report_artifacts -> section writers -> render_and_persist_final_report` | final report payloads and markdown |

By default the shipped workflow runs serial variants for planning, generation, runtime, and
finalization. `--parallel` enables concurrent work inside a single run where the workflow supports it.

## Outputs

`report.final.md` contains:

- simulation conclusion
- actor results table
- timeline
- actor dynamics
- major events

`simulation.log.jsonl` records:

- simulation start
- raw LLM call logs
- finalized plan
- finalized actors
- round focus selection
- round time advancement
- background updates
- adopted actions
- observer reports
- final report
- LLM usage summary

## Configuration

Settings resolve in this order:

1. built-in defaults
2. `env.toml`
3. environment variables
4. CLI overrides

Common runtime controls:

- `runtime.max_rounds`
- `runtime.max_actor_calls_per_step`
- `runtime.max_focus_slices_per_step`
- `runtime.max_recipients_per_message`
- `runtime.enable_checkpointing`
- `runtime.rng_seed`
- `--max-rounds` for CLI round-cap override
- `--trials` for sequential repeated runs
- `--parallel` for intra-run graph parallelism
- `--log-level` for CLI-visible logging verbosity

`--parallel` changes only work inside a single run. Trials stay sequential even when the flag is
enabled.

| Area | Default run | `--parallel` run |
| --- | --- | --- |
| trials | sequential | sequential |
| planning cast chunks | serial queue | concurrent chunk generation |
| generation actor slots | serial queue | concurrent slot generation |
| runtime actor proposals | serial queue | concurrent proposal generation |
| coordinator nodes | serial staged calls | serial staged calls |
| finalization sections | serial section writers | concurrent section writing |

Coordinator logic remains sequential. The current parallel switch only affects parts of the run
that can be processed concurrently.

Scenario files use YAML frontmatter with the following controls:

- `num_cast`
  - required positive integer
  - sets the requested cast count for planning and generation
- `allow_additional_cast`
  - optional boolean
  - defaults to `true`
  - `false`: require exactly `num_cast` cast entries
  - `true`: require at least `num_cast` cast entries

## Sample Scenarios

The repository includes scenario seeds in [`senario.samples/`](./senario.samples/README.md):

- `01_consumer_marketing_launch.md`
- `02_wargame_iran_us.md`
- `03_startup_boardroom_crisis.md`
- `04_city_hall_disaster_response.md`
- `05_korean_enterprise_promo_approval_conflict.md`
- `06_new_technology_internal_conflict.md`

## Documentation Map

| Document | Focus |
| --- | --- |
| [`docs/README.md`](./docs/README.md) | documentation map and reading order |
| [`docs/architecture.md`](./docs/architecture.md) | layers, execution path, and runtime boundaries |
| [`docs/contracts.md`](./docs/contracts.md) | public state surfaces, internal state groups, and artifacts |
| [`docs/llm.md`](./docs/llm.md) | role routing, prompt projections, and structured-output policy |
| [`docs/analysis.md`](./docs/analysis.md) | integrated analysis pipeline and output artifact layout |
| [`docs/workflows/README.md`](./docs/workflows/README.md) | workflow hub and stage handoffs |
| [`docs/operations.md`](./docs/operations.md) | local execution, validation, and maintenance |

## Development

Validate changes with:

```bash
uv run pytest -q
uv run ty check src
uv run ruff check src tests
uv run ruff clean
```
