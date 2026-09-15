# Configuration

`simula` uses role-based model settings for every model-backed stage.

## Resolution Model

Settings resolve in this order:

1. built-in defaults from `src/backend/core/settings`
2. `env.toml`, or the file pointed to by `SIMULA_ENV_TOML_PATH`
3. `settings.json`, or the file pointed to by `SIMULA_SETTINGS_PATH`
4. values saved through `PUT /api/settings`

Saved settings are normalized before writing. When the client sends a masked API key value
(`********`), the server keeps the previous secret.

## Server Environment Variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Bun API server port |
| `SIMULA_DATA_DIR` | `runs` under the repository root | live run artifact root |
| `SIMULA_SETTINGS_PATH` | `settings.json` under the repository root | saved settings file |
| `SIMULA_ENV_TOML_PATH` | `env.toml` under the repository root | local TOML settings file |
| `SIMULA_SAMPLE_DIR` | repository `senario.samples` directory | scenario sample root |

Runtime paths are resolved from the backend module's location in the checkout, independent of the
launch working directory. Relative path overrides are also relative to the repository root;
explicit absolute overrides are preserved. No developer home directory is embedded in the source.

The `runs/` directory name is also used by backend source modules. Git ignore rules must target
`/runs/` and `/apps/*/runs/` explicitly; an unanchored `runs/` rule excludes required source files
and makes fresh checkouts fail with a module-not-found error.

Earlier versions resolved defaults and relative overrides from the launch directory, commonly
`apps/server` when started through workspace scripts. Existing files are not moved automatically.
To keep that data location, explicitly set `SIMULA_DATA_DIR=apps/server/runs`,
`SIMULA_SETTINGS_PATH=apps/server/settings.json`, and/or `SIMULA_ENV_TOML_PATH=apps/server/env.toml`.
Otherwise place the desired files in the repository root. Check custom `SIMULA_*` values inherited
from the shell if an error still names an unexpected absolute path.

For web development, `SIMULA_API_ORIGIN` controls the Vite proxy target for `/api`.

## Model Roles

Every role resolves to one concrete `RoleSettings` object:

- `storyBuilder`
- `planner`
- `generator`
- `coordinator`
- `actor`
- `observer`
- `repair`

`actor` may inherit the coordinator settings when no actor-specific settings are provided.

## Providers

Supported providers:

| Provider | Notes |
| --- | --- |
| `openai` | requires API key |
| `anthropic` | requires API key |
| `gemini` | requires API key |
| `ollama` | OpenAI-compatible local provider, default base URL `http://localhost:11434/v1` |
| `lmstudio` | OpenAI-compatible local provider, default base URL `http://localhost:1234/v1` |
| `vllm` | OpenAI-compatible local provider, default base URL `http://localhost:8000/v1` |
| `litellm` | OpenAI-compatible gateway, default base URL `http://localhost:4000/v1` |

OpenAI-compatible providers require a `baseUrl`. Non-local providers require an API key.

## Role Settings

Each role setting contains:

- `provider`
- `model`
- `apiKey`
- `baseUrl`
- `temperature`
- `maxTokens`
- `timeoutSeconds`
- optional sampling and provider fields such as `topP`, `topK`, penalties, seed, `reasoningEffort`,
  `streamUsage`, `extraBody`, `extraHeaders`, and `safetySettings`

## Scenario Controls

Scenario controls are read from flat frontmatter:

```text
---
num_cast: 6
allow_additional_cast: true
actions_per_type: 3
max_round: 8
fast_mode: false
output_length: short
---
```

`num_cast` is required. `output_length` accepts `short`, `medium`, or `long` and also controls
actor memory compression length: 3, 5, or 10 sentences respectively. Unsupported keys fail explicitly.

## Settings loading failures

The settings dialog reads `GET /api/settings`; it does not need provider API keys or local model
servers to open. Missing local configuration files use the built-in defaults. Invalid existing
configuration files fail explicitly.

If settings cannot load, check the API server's startup output and open
`http://localhost:3001/api/settings` directly (adjust the port if configured). If the direct request
works but the web app fails, check the Vite `/api` proxy and `SIMULA_API_ORIGIN`. A running Vite page
does not prove that the backend process launched by `bun run dev` started successfully.

Settings reads time out after ten seconds. Failed reads show an error and an explicit Retry action
instead of leaving the dialog in its loading state.

## Related Docs

- server and artifact operations: [`operations.md`](./operations.md)
- model behavior: [`llm.md`](./llm.md)
- scenario contract: [`contracts.md`](./contracts.md)
