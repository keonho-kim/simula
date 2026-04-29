# Configuration

`simula` uses role-based model settings for every model-backed stage.

## Resolution Model

Settings resolve in this order:

1. built-in defaults from `packages/core/src/settings`
2. `env.toml`, or the file pointed to by `SIMULA_ENV_TOML_PATH`
3. `settings.json`, or the file pointed to by `SIMULA_SETTINGS_PATH`
4. values saved through `PUT /api/settings`

Saved settings are normalized before writing. When the client sends a masked API key value
(`********`), the server keeps the previous secret.

## Server Environment Variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Bun API server port |
| `SIMULA_DATA_DIR` | `runs` under the server working directory | live run artifact root |
| `SIMULA_SETTINGS_PATH` | `settings.json` under the server working directory | saved settings file |
| `SIMULA_ENV_TOML_PATH` | `env.toml` under the server working directory | local TOML settings file |
| `SIMULA_SAMPLE_DIR` | repository `senario.samples` directory | scenario sample root |

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

The actor role also supports `contextTokenBudget`; its default is `400`. Values above `400` are capped at runtime.

## Scenario Controls

Scenario controls are read from flat frontmatter:

```text
---
num_cast: 6
allow_additional_cast: true
actions_per_type: 3
max_round: 8
fast_mode: false
actor_context_token_budget: 400
output_length: short
---
```

`num_cast` is required. `output_length` accepts `short`, `medium`, or `long`. Unsupported keys fail explicitly.

## Related Docs

- server and artifact operations: [`operations.md`](./operations.md)
- model behavior: [`llm.md`](./llm.md)
- scenario contract: [`contracts.md`](./contracts.md)
