# Configuration

`simula` uses role-based model settings for every model-backed stage.

## Resolution Model

Settings begin with built-in defaults from `src/backend/core/settings`. The browser saves normal
settings in SQLite WASM and encrypts provider credentials using a user passphrase. `PUT /api/settings`
loads the unlocked values into the owning server session's memory for active work; it does not
write `settings.json` or `env.toml`. A masked API key value (`********`) retains the previous
value within that session.

## Server Environment Variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Bun API server port |
| `SIMULA_TLS_CERT_FILE` / `SIMULA_TLS_KEY_FILE` | generated local certificate outside the repository | HTTPS certificate and key; set both for trusted remote access |
| `SIMULA_SAMPLE_DIR` | repository `senario.samples` directory | scenario sample root |
| `SIMULA_LIBREOFFICE_BIN` | `soffice` | optional independent PDF text checker executable; required separately for legacy DOC conversion |
| `SIMULA_MODEL_QUEUE_LIMIT` | `1024` | maximum waiting model calls across pools |
| `SIMULA_MODEL_QUEUE_TIMEOUT_MS` | `120000` | maximum admission wait before the affected call fails |

Set **Concurrent model calls** in the LLM settings screen (`concurrency`, default 8, range 1–50).
Changes take effect without a restart. Use 50
only when the configured provider can accept 50 concurrent requests; this is independent of
world count and does not claim the provider performs 50 simultaneous inference passes.
The same allowance applies to each distinct endpoint/model pool. It is not a distributed
quota across multiple Node.js server processes or a hardware-wide limit across model names.

The bundled sample directory resolves from the checkout, independent of the launch directory.
The server puts active artifacts under a process-specific OS temporary directory and removes them
when the browser session expires or the server stops. Existing repository `runs/` and settings files
are not imported or deleted by this transition.

The Next custom server serves pages and `/api` on the same origin in development and production.
`bun run dev` provides local HTTPS. `bun run start` uses production mode; provide TLS through a
deployment proxy or the configured certificate paths.

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
PDF page interpretation currently uses the configured `storyBuilder` role; select a
vision-capable model for that role before extracting PDFs.

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
autonomous_progress: false
fast_mode: false
output_length: short
---
```

`num_cast` is required. `output_length` accepts `short`, `medium`, or `long` and also controls
actor memory compression length: 3, 5, or 10 sentences respectively. Unsupported keys fail explicitly.

`autonomous_progress` defaults to `false` (API/UI: `autonomousProgress`). In fixed mode,
`max_round` is a hard limit and no model-based progress or extension decision is called.
In autonomous mode, the coordinator compares the previous and current situation, event statuses,
actor state, and round actions after every round. The initial situation is the baseline for round 1.
It must return `1` (meaningful progress; allow the next round even beyond `max_round`) or `0`
(stop). Repeated actions or reinjecting the same event do not count as progress by themselves.
The existing exact-choice repair and five-attempt validation apply; exhausted invalid responses
fail explicitly. There is no five-round extension batch. The configured maximum stays unchanged.
Autonomous progression is separate from the UI's Auto continue switch, which controls waiting
between rounds. Manual continuation and cancellation still apply in autonomous mode.

## Settings loading failures

The settings dialog reads `GET /api/settings`; it does not need provider API keys or local model
servers to open. Missing local configuration files use the built-in defaults. Invalid existing
configuration files fail explicitly.

If settings cannot load, check the single server's startup output and open
`https://localhost:3001/api/settings` directly (adjust the port if configured). A page response
alone does not prove the backend runtime initialized; verify this API response too.

Settings reads time out after ten seconds. Failed reads show an error and an explicit Retry action
instead of leaving the dialog in its loading state.

## Related Docs

- server and artifact operations: [`operations.md`](./operations.md)
- model behavior: [`llm.md`](./llm.md)
- scenario contract: [`contracts.md`](./contracts.md)
