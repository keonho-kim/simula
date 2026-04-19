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

The parser requires:

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

The simulator can run the same scenario multiple times. Trials are always executed sequentially.

Repeated trials:

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3
```

Intra-run graph parallelism:

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --parallel
```

You can combine both:

```bash
uv run simula \
  --scenario-file ./senario.samples/03_startup_boardroom_crisis.md \
  --trials 3 \
  --parallel
```

Operational notes:

- `--trials` must be `>= 1`
- `--parallel` enables concurrent work inside one run
- without `--parallel`, the default workflow uses the serial variants
- for SQLite storage, repeated trials rewrite the SQLite database path to sibling files under a
  `trial-runs/` directory so repeated trials do not share one runtime database
- the file output root still comes from `storage.output_dir`

Parallel behavior by area:

| Area | Default run | `--parallel` run |
| --- | --- | --- |
| trials | sequential | sequential |
| planning cast chunks | serial queue | concurrent chunk generation |
| generation actor slots | serial queue | concurrent slot generation |
| runtime actor proposals | serial queue | concurrent proposal generation |
| coordinator round planning and resolution | serial staged calls | serial staged calls |
| finalization report sections | serial section writers | concurrent section writing |

The `--parallel` flag does not make every LLM call concurrent. Coordinator stages such as round
directive building, round resolution, and continuation checks remain sequential inside each run.

For Korean plot labels on Ubuntu, install the recommended system packages first:

```bash
./scripts/install_deps_ubuntu.sh
```

## Output Layout

Each completed simulation run writes:

```text
<storage.output_dir>/<run_id>/
  manifest.json
  report.final.md
  summary.overview.md
  simulation.log.jsonl
  data/
  summaries/
  assets/
```

The repository also keeps committed sample runs under:

```text
output.samples/<run_id>/
```

Use the two directories differently:

| Path | Meaning |
| --- | --- |
| `<storage.output_dir>/` | live runtime output written by the simulator |
| `output.samples/` | committed reference runs checked into the repository |

`run_id` now follows:

```text
YYYYMMDD.001.<actor-model-id>.<scenario-file-stem>
```

The responsibilities are split deliberately:

- `simula.shared.io.RunJsonlAppender` writes `simulation.log.jsonl` incrementally during execution
- the workflow builds structured report payloads and markdown text in memory
- the executor reuses the completed JSONL file as the source-of-truth for derived analysis
- the integrated output writer writes `report.final.md`, `summary.overview.md`, `data/*`,
  `summaries/*`, `assets/*`, and one unified `manifest.json`

The integrated analysis artifacts include:

```text
<storage.output_dir>/<run_id>/
  data/llm_calls.csv
  data/performance.summary.csv
  data/fixer.summary.csv
  data/token_usage.summary.csv
  data/actions.summary.csv
  data/network.nodes.csv
  data/network.edges.csv
  data/network.growth.csv
  data/network.summary.json
  summaries/token_usage.summary.md
  summaries/network.summary.md
  assets/performance.summary.png
  assets/network.graph.png
  assets/network.graph.graphml
  assets/network.growth_metrics.png
  assets/network.concentration.png
  assets/network.growth.mp4
```

Some analyzer artifacts are conditional:

- `actions/summary.csv` is written only when there are action rows to report
- `network/growth.csv` is written only when growth rows exist
- `network/growth.mp4` is recorded only when video rendering produces a file

When you need an example output tree for inspection, prefer `output.samples/` over `output/`
because `output/` is intentionally treated as a local runtime workspace.

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

- Keep docs aligned with the current graph and code paths.
- Treat `simulation.log.jsonl` as the source artifact for analysis, not as a derived export.
- Treat `<run_dir>/summary.overview.md` as the default human-readable entrypoint for derived analysis.
- Update the workflow docs when active node names, branch points, or stage outputs change.
- Keep shared logging and runtime-output helpers under `simula.shared.*` rather than scattering
  them across application and workflow packages.
- Prefer domain subpackages such as `simula.domain.activity`, `simula.domain.runtime`, and
  `simula.domain.reporting` over adding more flat modules directly under `simula.domain`.
