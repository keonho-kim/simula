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

Planner generates one action per model call, sequentially within each visibility scope. Each
response is one JSON object with exactly label, intentHint, and expectedOutcome. The existing
LangChain parseJsonMarkdown utility with JSON.parse handles the completed response; Zod validates
field types, bounds, and unknown keys. No custom JSON parser or pipe-delimited compatibility path
is retained. IDs and visibility remain program-owned.

Korean scenarios receive Korean instructions and examples, with English JSON keys and Korean
values. Language errors identify the failing fields. Context reserves space for each digest
section rather than truncating a combined digest. Accepted labels and purposes are included in
subsequent calls; normalized duplicates and numbering variants remain invalid.

Each action has at most five attempts. A failure retries only that slot; accepted actions and
codes stay unchanged. Failure logs identify scope, slot, attempt and validation issue. The final
catalog is installed only when every slot passes. Default three actions per scope now require
12 initial calls rather than four batches; this trades additional round trips for smaller tasks.
Generation is deliberately sequential because each action must compare against all accepted
labels. Provider-specific JSON response-format flags are not forced on servers with unknown
support; the prompt requests JSON and application validation enforces the contract.

For live previews, LangChain's existing partial JSON parsing extracts named string fields as
tokens arrive. Only these draft fields are sent through item-specific preview SSE and rendered
under localized headings. Partial JSON never becomes an accepted action. Retry resets all three
fields, and final parsing is strict even though preview parsing tolerates incomplete JSON.

Actor selection continues to use the existing short exact-choice responses, allowed-output
validation, and repair role. The default catalog has twelve codes plus `no_action`, and a solitary
Actor can select only solitary actions. Visibility is fixed per code to avoid adding another
selection call or requiring a multi-field response from smaller models.

Automated verification uses deterministic provider responses and malformed-response fixtures.
These checks establish protocol behavior, not measured semantic quality or reliability on an
actual 27B (or smaller) model; that requires evaluation with the intended local model.

## Actor thought, intent, and speech

Actor text prompts distinguish private interpretation (`thought`), the purpose of the chosen
behavior (`intent`), and recipient-facing dialogue (`message`). Intent receives the preceding
thought, current event, and pre-round context. Speech receives event context alongside thought,
intent, action, and target. Korean and English instructions include one connected role example;
only the current step is requested, and the example's content must not be copied. Honest speech
is allowed; actors are not required to invent hidden motives or contradict their thoughts.

Speech validation rejects only whole-response copies of thought or intent, after Unicode,
case, whitespace, and punctuation normalization. It does not reject semantic similarity or
shared phrases. A rejected response receives localized feedback identifying the copied field
and asking for recipient-facing speech while retaining the previous decisions. Only speech is
retried, with at most three total attempts. Exhaustion fails explicitly without inventing a
replacement line. Existing silence and no-action behavior is preserved; target and action
exact-choice validation and repair remain unchanged.
