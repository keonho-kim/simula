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


## Small-model action catalog generation

Planner defines actions in sequential batches of at most three, one visibility at a time. The
model returns `label | usage condition | expected effect` lines, not a JSON map. Program code
assigns the ids. Conditions and effects have 200-character limits and labels have a 40-character
limit. Context budgets preserve both scenario and planner information. Prompts request concrete,
varied mechanisms and show previously accepted labels.

Validation requires bounded row counts, exact field counts, non-empty bounded fields, distinct normalized
labels (including rejection of variants distinguished only by numbering), and Korean fields for
Korean scenarios. Codes, placeholders, and the former generic visibility templates are not valid
labels. Valid rows are retained even if neighboring rows are malformed or duplicated. Missing
rows are regenerated one at a time, with at most five calls per original batch. Retry feedback
accumulates validation failures and identifies the conflicting code, scope, and accepted label;
all accepted actions are included in the exclusion list. Codes remain contiguous as valid rows
are accepted. Excess rows are rejected explicitly. Exhaustion reports accepted/missing counts
and conflicts; no invented fallback actions or partial catalog is installed. Transport/storage failures propagate instead of being treated as
model formatting errors. Existing reasoning separation and metric/log emission remain in use.

Actor selection continues to use the existing short exact-choice responses, allowed-output
validation, and repair role. The default catalog has twelve codes plus `no_action`, and a solitary
Actor can select only solitary actions. Visibility is fixed per code to avoid adding another
selection call or requiring a multi-field response from smaller models.

Automated verification uses deterministic provider responses and malformed-response fixtures.
These checks establish protocol behavior, not measured semantic quality or reliability on an
actual 27B (or smaller) model; that requires evaluation with the intended local model.
