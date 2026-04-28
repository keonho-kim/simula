# Model Design

`simula` uses model calls as bounded contributors to a larger stateful simulation. Models create
structured proposals, but the system validates and records those proposals before they become part
of the run.

## Model Roles

| Role | Responsibility |
| --- | --- |
| Planner | Interpret the scenario and produce planning bundles. |
| Generator | Turn planned cast slots into concrete actor cards. |
| Coordinator | Advance one runtime focus through actor actions, event updates, and world-state changes. |
| Observer | Draft the final report from the completed trace. |
| Repair | Recover malformed structured responses when recovery is allowed. |

Role separation keeps each model call small and purpose-specific.

## Model Inputs

Model calls receive compact stage-specific inputs.

- Planning receives scenario text, scenario controls, and partial planning context.
- Actor generation receives the execution plan and assigned cast entries.
- Runtime receives the selected event, selected actors, recent effects, current intent state, and
  current world summary.
- Finalization receives a report projection derived from the completed trace.

The goal is to avoid passing the whole world into every call. Each stage gets only the context it
needs to produce its contract.

## Structured Outputs

Most model-backed stages expect structured responses.

The normal acceptance path is:

1. request a response for one role
2. parse the response
3. validate it against the stage contract
4. normalize accepted data where the stage requires canonical fields
5. merge the result into workflow state

Structured output is a product contract, not just a formatting preference. It allows later stages
to reason over actors, events, actions, reports, and metrics.

## Validation And Recovery

Validation is stage-specific.

- Planning checks that cast, actions, and events are internally consistent.
- Actor generation checks that generated actors match planned cast slots.
- Runtime checks that scene updates affect the selected event and selected actors.
- Finalization checks that report sections can be rendered from the completed trace.

When a response is malformed, the system may retry or use the repair role if that stage allows
recovery. Runtime may use explicit default behavior for bounded scene advancement, but that default
must remain visible through logs and errors.

## Observability

Every run records model-call metadata in `simulation.log.jsonl`.

The log supports:

- role-level timing inspection
- token and usage summaries when available
- recovery and default tracking
- per-stage performance comparison
- analysis of how model calls contributed to the final report

The event log is also the source for derived analysis artifacts.

## Related Docs

- data contracts: [`contracts.md`](./contracts.md)
- configuration concepts: [`configuration.md`](./configuration.md)
- workflow stages: [`workflows/README.md`](./workflows/README.md)
