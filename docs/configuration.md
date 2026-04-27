# Configuration

`simula` loads a typed `AppSettings` object from four layers:

1. built-in defaults
2. `env.toml` or an explicit `--env` file
3. environment variables
4. CLI overrides

The preferred operator path is still:

```bash
cp env.sample.toml env.toml
```

The sample file is not the only supported path, but it is the clearest starting point for local
setup.

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
- `--DEBUG` -> `SIM_LOG_LEVEL=DEBUG`

## `env.toml` Shape

The loader accepts the current nested structure only. Legacy flat keys such as `SIM_*` inside the
TOML file are rejected.

| Table | Purpose | Notes |
| --- | --- | --- |
| `[env]` | general runtime controls | log level, runtime budgets, recipient cap, checkpointing, RNG seed |
| `[time]` | runtime round cap | only `max_rounds` is allowed |
| `[db]` | storage provider selection | choose `sqlite` or `postgresql` |
| `[db.sqlite]` | SQLite path settings | required when `db.provider = "sqlite"` |
| `[db.postgresql]` | PostgreSQL connection and table names | required when `db.provider = "postgresql"` |
| `[fs]` | file output directory | controls the live simulation run directory root, typically `output/` |
| `[llm.<provider>]` | provider-wide defaults | shared credentials and provider-specific defaults |
| `[llm.<role>]` | role routing and per-role overrides | one of `planner`, `generator`, `coordinator`, `observer`, `fixer` |

### Runtime keys

`[env]` accepts:

- `log_level`
- `max_recipients_per_message`
- `max_scene_actors`
- `max_scene_candidates`
- `max_scene_beats`
- `actor_roster_chunk_size`
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

The committed repository examples under `output.samples/` are not controlled by `output_dir`.
They are checked-in snapshots, not live runtime outputs.

## LLM Routing Model

The settings model always resolves five logical roles:

- `planner`
- `generator`
- `coordinator`
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
- `[llm.openai-compatible]`
- `[llm.anthropic]`
- `[llm.google]`
- `[llm.bedrock]`

For example, a role with `provider = "openai"` inherits shared `API_KEY`, `base_url`,
`stream_usage`, `reasoning_effort`, and `verbosity` from `[llm.openai]` unless `[llm.<role>]` overrides them.
`provider = "openai-compatible"` inherits shared `API_KEY`, `base_url`, and `stream_usage` from
`[llm.openai-compatible]`, and any other keys from that table are forwarded through `extra_body`.
Role-level shared fields such as `temperature`, `max_tokens`, and `timeout_seconds` still apply
normally to OpenAI-compatible models.
For example, `reasoning = { effort = "medium" }` inside `[llm.openai-compatible]` or `[llm.<role>]`
is forwarded to the server as part of `extra_body`, but whether that field is honored depends on
the specific OpenAI-compatible server.

### Role tables

Each `[llm.<role>]` table sets routing and optional provider-specific overrides directly:

- `provider`
- `model`
- `temperature`
- `max_tokens`
- `timeout_seconds`
- provider-specific fields such as `API_KEY`, `base_url`, `stream_usage`, `thinking_budget`, or `region_name`

For `provider = "openai-compatible"`, only `API_KEY`, `base_url`, and `stream_usage` are reserved provider keys.
Any additional keys in `[llm.openai-compatible]` or `[llm.<role>]` are forwarded through
`extra_body`. You can also use `extra_body = { ... }` as an inline table.

Examples:

- LM Studio-style:
  `reasoning = { effort = "medium" }`
- vLLM-style:
  `extra_body = { chat_template_kwargs = { enable_thinking = false } }`

`stream_usage = true` requests token usage in streaming responses when the provider supports it.
LM Studio supports this on OpenAI-compatible endpoints. Servers that do not support streaming
usage may still leave token counts empty while TTFT and duration continue to be recorded.

Nested role provider tables such as `[llm.planner.openai]` are no longer supported. Put
provider-specific keys directly inside the role table.

### Important defaults and special cases

- `planner`, `generator`, and `observer` default to OpenAI-style routing when no role config is
  present.
- `coordinator` inherits the planner config when no coordinator-specific role config is present.
- `fixer` has OpenAI-style built-in defaults at the model-builder layer, but the loader still
  requires explicit fixer role configuration to exist. It rejects a config that does not define
  `[llm.fixer]` or equivalent `SIM_FIXER_*` environment variables.

## Validation Rules

The config validator is intentionally strict.

- OpenAI and Anthropic roles require an API key.
- OpenAI-compatible roles require `base_url`.
- Google requires either a Gemini API key or a complete Vertex path
  (`project_id` plus `location`).
- Bedrock requires `region_name`.
- OpenAI `reasoning_effort` and `verbosity` are only valid for GPT-5 model names.
- Provider-specific fields are rejected when they are attached to the wrong provider.

The loader reads environment variables with these prefixes:

- `SIM_`
- `OPENAI_`
- `OPENAI_COMPATIBLE_`
- `ANTHROPIC_`
- `GOOGLE_`
- `BEDROCK_`

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
