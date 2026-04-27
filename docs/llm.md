# LLM Design

## Overview

`simula` routes model calls through a small set of named roles. Each role owns one part of the
workflow, and configuration decides which provider and model back that role.

| Role | Responsibility |
| --- | --- |
| `planner` | split planning bundle generation |
| `generator` | bundled actor-card generation |
| `coordinator` | scene tick delta selection |
| `observer` | one-shot final report draft |
| `fixer` | JSON repair for malformed structured responses |

## Provider Support

The application supports:

- OpenAI
- OpenAI-compatible
- Anthropic
- Google
- Bedrock

Provider and model settings are described in [`configuration.md`](./configuration.md).

## Model Inputs

Model calls use compact, stage-specific inputs.

- Planning uses several small structured calls for analysis, cast outline, situation, action catalog, coordination frame, major events, and cast chunks.
- Generation receives compact plan context plus one cast chunk and returns an `ActorRosterBundle`.
- Runtime coordinator calls receive one selected event, scene actors, candidates, and recent effects.
- Finalization receives the completed run projection once and returns a `FinalReportDraft`.

The goal is simple: each stage gets the information it needs without carrying the entire workflow
state into every call.

## Structured Outputs

Most model calls use local parsing and validation. Structured responses are checked in code before
they are accepted into workflow state.

The common path is:

1. call the configured model for a role
2. parse the response locally
3. validate the result against the expected schema or contract
4. apply local normalization when the stage requires it

When parsing fails, the runtime may retry, repair malformed JSON through the `fixer` role, or use
an explicit default value when that stage defines one.

## Failure Handling

Different stages use different policies, but the rules are consistent:

- planning and generation fail when their required structured outputs cannot be recovered
- runtime scene ticks can use explicit defaults
- final report drafting is one structured call validated in code
- repair stays visible through logs and analysis artifacts

The system prefers explicit failure or explicit defaults over silent degradation.

## Logging and Observability

Every run records model-call activity in `simulation.log.jsonl`. The log includes role, timings,
token counts when available, and per-call context for later analysis.

This log is also the source for derived analysis artifacts such as token summaries, performance
tables, and fixer usage reports.

## Related Docs

- configuration and provider rules: [`configuration.md`](./configuration.md)
- state and artifact contracts: [`contracts.md`](./contracts.md)
- stage-level workflow docs: [`workflows/README.md`](./workflows/README.md)
