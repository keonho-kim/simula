# Configuration

## Purpose

`simula` loads a typed `AppSettings` object from four layers:

1. built-in defaults
2. `env.toml` or an explicit `--env` file
3. environment variables
4. CLI overrides

The preferred operator path is still:

```bash
cp env.sample.toml env.toml
```

The sample file is not the only supported path, but it is the clearest one because the final
settings model is stricter than a typical toy prototype.

## Resolution Rules

### File resolution

- `--env /path/to/file.toml`: use that file and fail if it does not exist
- no `--env`, local `env.toml` exists: use `./env.toml`
- no `--env`, no local `env.toml`: continue with defaults plus environment variables

### Precedence

Later layers override earlier ones:

1. built-in defaults from the config builders
2. parsed TOML values
3. real environment variables
4. CLI overrides from `simula`

The only current CLI overrides are:

- `--max-rounds` -> `SIM_MAX_ROUNDS`
- `--log-level` -> `SIM_LOG_LEVEL`

## `env.toml` Shape

The loader accepts the current nested structure only. Legacy flat keys such as `SIM_*` inside the
TOML file are rejected.

| Table | Purpose | Notes |
| --- | --- | --- |
| `[env]` | general runtime controls | log level, actor-call caps, recipient cap, checkpointing, RNG seed |
| `[time]` | runtime round cap | only `max_rounds` is allowed |
| `[db]` | storage provider selection | choose `sqlite` or `postgresql` |
| `[db.sqlite]` | SQLite path settings | required when `db.provider = "sqlite"` |
| `[db.postgresql]` | PostgreSQL connection and table names | required when `db.provider = "postgresql"` |
| `[fs]` | file output directory | controls the simulation run directory root |
| `[llm.<provider>]` | provider-wide defaults | shared credentials and provider-specific defaults |
| `[llm.<role>]` | role routing and per-role overrides | one of `planner`, `generator`, `coordinator`, `actor`, `observer`, `fixer` |

### Runtime keys

`[env]` accepts:

- `log_level`
- `max_recipients_per_message`
- `max_actor_calls_per_step`
- `max_focus_slices_per_step`
- `enable_checkpointing`
- `rng_seed`

`[time]` accepts only:

- `max_rounds`

### Storage keys

`[db]` accepts:

- `provider`

`[db.sqlite]` accepts:

- `dir`
- `path`

`[db.postgresql]` accepts:

- `host`
- `port`
- `user`
- `password`
- `database`
- `schema`
- `runs_table`
- `actors_table`
- `activities_table`
- `observer_reports_table`
- `final_reports_table`

`[fs]` accepts:

- `output_dir`

## LLM Routing Model

The settings model always resolves six logical roles:

- `planner`
- `generator`
- `coordinator`
- `actor`
- `observer`
- `fixer`

Each role resolves to one `ModelConfig` containing:

- `provider`
- `model`
- `temperature`
- `max_tokens`
- `timeout_seconds`
- provider-specific options

### Shared provider defaults

The top-level provider tables supply shared defaults for matching roles:

- `[llm.openai]`
- `[llm.anthropic]`
- `[llm.google]`
- `[llm.bedrock]`
- `[llm.ollama]`
- `[llm.vllm]`

For example, a role with `provider = "openai"` inherits shared `API_KEY`, `base_url`,
`reasoning_effort`, and `verbosity` from `[llm.openai]` unless `[llm.<role>]` overrides them.

### Role tables

Each `[llm.<role>]` table sets routing and optional provider-specific overrides directly:

- `provider`
- `model`
- `temperature`
- `max_tokens`
- `timeout_seconds`
- provider-specific fields such as `API_KEY`, `base_url`, `thinking_budget`, or `region_name`

Nested role provider tables such as `[llm.actor.openai]` are no longer supported. Put
provider-specific keys directly inside `[llm.actor]`.

### Important defaults and special cases

- `planner`, `generator`, and `observer` default to OpenAI-style routing when no role config is
  present.
- `actor` defaults to Ollama-style routing when no role config is present.
- `coordinator` inherits the planner config when no coordinator-specific role config is present.
- `fixer` has OpenAI-style built-in defaults at the model-builder layer, but the loader still
  requires explicit fixer role configuration to exist. It rejects a config that does not define
  `[llm.fixer]` or equivalent `SIM_FIXER_*` environment variables.

## Validation Rules

The config validator is intentionally strict.

- OpenAI and Anthropic roles require an API key.
- Google requires either a Gemini API key or a complete Vertex path
  (`project_id` plus `location`).
- Ollama and vLLM require `base_url`.
- Bedrock requires `region_name`.
- OpenAI `reasoning_effort` and `verbosity` are only valid for GPT-5 model names.
- Provider-specific fields are rejected when they are attached to the wrong provider.

The loader reads environment variables with these prefixes:

- `SIM_`
- `OPENAI_`
- `ANTHROPIC_`
- `GOOGLE_`
- `BEDROCK_`
- `OLLAMA_`
- `VLLM_`

## Storage and Checkpoints

### SQLite

When `db.provider = "sqlite"`:

- the application store uses the configured SQLite database
- schema creation happens automatically on startup
- if checkpointing is enabled, LangGraph stores checkpoints in a sibling SQLite file named
  `<sqlite_stem>.checkpoints<suffix>`

Example:

- runtime database: `./data/db/runtime.sqlite`
- checkpoint database: `./data/db/runtime.checkpoints.sqlite`

### PostgreSQL

When `db.provider = "postgresql"`:

- the application store validates the configured schema and table layout on startup
- checkpointing uses LangGraph's PostgreSQL saver
- schema creation is not implicit unless you run the bootstrap command

Initialize PostgreSQL storage explicitly before the first run when needed:

```bash
uv run python -m simula.infrastructure.storage.schema_bootstrap --env ./env.toml
```

If checkpointing is enabled for PostgreSQL, that bootstrap command also creates the checkpoint
tables.

## Related Docs

- local execution and commands: [`operations.md`](./operations.md)
- system boundaries: [`architecture.md`](./architecture.md)
- role routing and retries: [`llm.md`](./llm.md)
