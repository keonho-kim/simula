# Model Design

`simula` routes model calls through named roles. Each role has its own provider, model, sampling,
timeout, and token settings.

## Roles

| Role | Responsibility |
| --- | --- |
| `storyBuilder` | draft a scenario from user messages before a run is created |
| `planner` | interpret the scenario and build scenario digest, event plan, and runtime direction |
| `generator` | build roster entries and actor cards |
| `coordinator` | coordinate runtime rounds and event progress |
| `actor` | produce actor choices, messages, and context updates |
| `observer` | summarize rounds and contribute report-ready observations |
| `repair` | recover malformed structured responses when a stage allows repair |

Role separation keeps prompts small and makes per-stage provider choices explicit.

## Providers

Supported providers are:

- `openai`
- `anthropic`
- `gemini`
- `ollama`
- `lmstudio`
- `vllm`
- `litellm`

`ollama`, `lmstudio`, `vllm`, and `litellm` are OpenAI-compatible providers and require a base URL.
Other providers require an API key.

## Inputs and Outputs

Model calls receive compact stage-specific inputs:

- planning receives the scenario text and scenario controls
- generator calls receive the plan and one roster or actor-card task
- coordinator calls receive current world state, event pressure, and round context
- actor calls receive one actor plus visible context and allowed actions
- observer calls receive round or completed-state context

Accepted outputs are parsed, validated, normalized, and then merged into workflow state. Machine
tokens such as actor ids and action ids remain exact even when the prompt language is Korean.

## Metrics

Every model-backed step emits `model.metrics` when it completes. Metrics include:

- role
- step
- attempt
- time to first token
- duration
- input/output/total token counts when available
- whether token data came from the provider or was unavailable

These events are written to `events.jsonl` and streamed to the web app.

## Recovery

Stages retry empty or malformed responses where the current workflow defines a retry path. When a
repair path exists, the `repair` role receives the invalid output and allowed shape. If recovery is
not possible, the run fails explicitly.

Runtime may use explicit no-action behavior only where that behavior is part of the current actor
decision contract.

## Related Docs

- configuration: [`configuration.md`](./configuration.md)
- contracts: [`contracts.md`](./contracts.md)
- workflow stages: [`workflows/README.md`](./workflows/README.md)
