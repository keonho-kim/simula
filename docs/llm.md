# LLM Design

## Role Model

`simula` routes structured calls through five logical roles.

| Role | Owns |
| --- | --- |
| `planner` | scenario analysis and execution plan creation |
| `generator` | actor card generation |
| `coordinator` | step directive and step resolution |
| `actor` | one actor action proposal |
| `observer` | timeline anchor inference and final report sections |

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

### Runtime actor

- compact actor card
- selected focus slice
- visible action context
- unread backlog digest
- visible actors
- runtime guidance with allowed actions

### Finalization

- scenario text
- final report JSON
- `report_projection_json`
- timeline hints extracted from the scenario when available

## Structured Output Policy

Active structured responses are required-only. Missing data is represented through explicit empty
values inside workflow state, not through optional schema fields.

Planning uses native structured output where available. Runtime nodes keep an explicit default path
for resiliency, but that path is recorded in `errors` instead of being hidden.

## Retry and Default Strategy

| Stage | Strategy |
| --- | --- |
| planning analysis | strict structured call |
| execution plan | strict structured call |
| actor generation | strict structured call |
| step directive | structured call with explicit default payload |
| actor proposal | structured call with explicit default payload |
| step resolution | structured call with explicit default payload |
| timeline anchor | strict structured call after parser hints |
| final report bundle | structured call with one validation-driven retry |

## Validation Rules

- Structured responses are validated by Pydantic models.
- Runtime report sections are additionally checked for section shape and forbidden jargon.
- Prompt examples show only required fields.
- Prompt projections intentionally cap list sizes and text lengths to keep token growth bounded.

## Practical Guidance

- Add a new role only if a genuinely distinct responsibility appears.
- Prefer tightening projections before expanding schemas.
- Keep examples minimal and contract-shaped.
- If a default path is necessary, make it explicit and observable.
