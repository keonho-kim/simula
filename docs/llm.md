# LLM Design

## Role Model

`simula` routes all model calls through six stable logical roles.

| Role | Owns |
| --- | --- |
| `planner` | scenario analysis and execution plan creation |
| `generator` | actor card generation |
| `coordinator` | round continuation checks, round directives, and round resolution |
| `actor` | one actor action proposal |
| `observer` | timeline anchor inference and final report section writing |
| `fixer` | JSON-only repair for malformed structured responses |

The router keeps these role boundaries stable even when the configured provider changes.

## Provider Support

The current provider adapters support:

- OpenAI
- OpenAI-compatible
- Anthropic
- Google
- Bedrock

Configuration is described in [`configuration.md`](./configuration.md), but the important runtime
idea is simple: the workflow chooses roles, and the settings choose which provider/model backs each
role.

## Prompt Projection Policy

The workflow never dumps the full internal state into prompts. Each role receives a compact,
purpose-built projection.

### Planning

- raw scenario text
- runtime round cap
- planning-analysis context

### Generation

- compact interpretation view
- compact situation view
- compact action catalog view
- compact coordination frame view
- one cast roster item

### Runtime coordinator

- compact focus candidates
- deferred actor views
- compact situation and coordination-frame views
- recent observer summaries and recent activity summaries
- pending actor proposals and background updates
- event memory state and round-level event hints
- previous actor-facing digest and stagnation counters

### Runtime actor

- one actor card
- one selected focus slice
- visible action context
- unread backlog digest
- visible actors
- runtime guidance, including allowed actions, constraints, and current intent snapshot

### Finalization

- timeline anchor inference uses scenario text plus parser-extracted time hints
- section writers use shared report prompt inputs plus local validators rather than structured
  output schemas

## Structured Output Policy

All active structured responses use local parsing and Pydantic validation. Native provider
structured-output APIs are not used as the source of truth.

The normal path is:

1. call the role model
2. parse locally
3. validate against the contract
4. normalize if needed

If parsing fails:

1. retry the original prompt with a stricter JSON suffix
2. if still invalid, call the `fixer` role with the malformed response and schema context
3. re-validate the repaired JSON locally

Runtime nodes that define `default_payload` values keep that explicit observable fallback path.

## Retry and Default Strategy

| Stage | Strategy |
| --- | --- |
| planning analysis | strict structured call |
| execution plan | strict structured call |
| actor generation | strict structured call |
| round continuation | structured call with explicit default payload |
| round directive | structured call with explicit default payload |
| actor proposal | structured call with explicit default payload and semantic validation |
| round resolution | structured call with explicit default payload |
| timeline anchor | strict structured call after parser-first hints |
| final report sections | text call with one validation-driven retry |
| fixer | JSON-only repair with bounded retries |

## Logging and Observability

The LLM router does more than just pick a model.

It also:

- streams provider responses so TTFT and total duration can be measured
- extracts token counts when the provider exposes them
- records role-specific usage into `llm_usage_tracker`
- emits raw `llm_call` events into `simulation.log.jsonl`
- logs readable summaries for operators

Each raw `llm_call` event contains:

- `role`
- `call_kind`
- `prompt`
- `raw_response`
- `log_context`
- `duration_seconds`
- `ttft_seconds`
- `input_tokens`
- `output_tokens`
- `total_tokens`

This makes the JSONL log the primary evidence source for later analysis.

## Validation Rules

- prompt-facing structured schemas are required-only
- runtime actor proposals receive semantic validation after JSON parsing
- final report sections are checked by local validators after text generation
- prompt projections intentionally cap list sizes and text lengths to keep token growth bounded
- stop decisions use explicit enums instead of free-form prose

## Practical Guidance

- add a new role only when there is a genuinely separate responsibility
- tighten prompt projections before expanding schemas
- prefer explicit default payloads over silent degradation
- keep raw-call logging stable because the analyzer depends on it

## Related Docs

- configuration and provider rules: [`configuration.md`](./configuration.md)
- structured artifact contracts: [`contracts.md`](./contracts.md)
- stage-level prompt consumers: [`workflows/README.md`](./workflows/README.md)
