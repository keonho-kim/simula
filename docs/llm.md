# LLM Design

## Role Model

`simula` routes LLM calls through six logical roles.

| Role | Owns |
| --- | --- |
| `planner` | scenario analysis and execution plan creation |
| `generator` | actor card generation |
| `coordinator` | step directive, round continuation checks, and step resolution |
| `actor` | one actor action proposal |
| `observer` | timeline anchor inference and final report sections |
| `fixer` | JSON-only repair for failed structured responses |

The router maps those roles onto configured provider models. The role boundary is stable even when
the underlying provider changes.

## Prompt Input Policy

The workflow does not pass raw internal state into LLM prompts. Each role receives a compact
projection assembled for the job at hand.

### Planning

- raw scenario text
- max step budget
- compact planning analysis JSON

### Generation

- compact interpretation view
- compact situation view
- compact action catalog
- compact coordination frame
- one cast roster item

### Runtime coordinator

- compact focus candidates
- compact deferred actor views
- compact situation and coordination frame views
- compact step history summaries
- compact pending actor proposals and background updates
- compact continuation-check summaries such as recent observer reports, latest round activities, the last focus plan, and `event_memory`
- compact round-resolution inputs including the previous actor-facing digest and `stagnation_rounds`

### Runtime actor

- compact actor card
- selected focus slice
- visible action context
- unread backlog digest
- visible actors
- runtime guidance with allowed actions
- channel guidance and current constraints inside runtime guidance

### Finalization

- timeline anchor inference receives scenario text, parser-extracted date/time/context hints, elapsed-time summary, and max-round context as one structured call
- final report section writers use text prompts built from shared report prompt inputs and local validators instead of structured schemas

## Structured Output Policy

Active structured responses are required-only. Missing data is represented through explicit empty
values inside workflow state, not through optional schema fields.

All structured responses use the local JSON parser path. Native provider structured-output APIs are
not used.

If a structured response fails parsing, `simula` retries the original prompt with a stricter JSON
suffix. If that still fails, it calls the `fixer` role with only the malformed response text and
re-validates the repaired JSON locally. Runtime nodes that already define `default_payload` values
still keep that explicit fallback path, and the fallback remains observable.

## Retry and Default Strategy

| Stage | Strategy |
| --- | --- |
| planning analysis | strict structured call |
| execution plan | strict structured call |
| actor generation | strict structured call |
| round continuation | structured call with explicit default payload |
| round directive | structured call with explicit default payload |
| actor proposal | structured call with explicit default payload |
| round resolution | structured call with explicit default payload |
| timeline anchor | strict structured call after parser hints |
| final report section writers | text call with one validation-driven retry per section |
| fixer helper | JSON-only repair with up to 3 retries and 60-second wait |

## Validation Rules

- Structured responses are validated by Pydantic models.
- Runtime report sections are additionally checked for section shape and forbidden jargon.
- Prompt examples show only required fields.
- Prompt projections intentionally cap list sizes and text lengths to keep token growth bounded.
- Runtime stop contracts use explicit enum strings instead of free-form stop messages.

## Practical Guidance

- Add a new role only if a genuinely distinct responsibility appears.
- Prefer tightening projections before expanding schemas.
- Keep examples minimal and contract-shaped.
- If a default path is necessary, make it explicit and observable.
