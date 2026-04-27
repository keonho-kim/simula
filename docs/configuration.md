# Configuration

This document describes configuration concepts without prescribing a language-specific setup path.
Concrete command syntax belongs outside this documentation until the current runtime transition is
settled.

## Resolution Model

Settings are expected to resolve from layered sources.

1. built-in defaults
2. local configuration file
3. environment variables
4. explicit run overrides

Later layers override earlier layers. A run should record a redacted settings summary in
`manifest.json` so saved artifacts remain inspectable.

## Configuration Areas

| Area | Purpose |
| --- | --- |
| Runtime controls | Round limits, recipient caps, scene size limits, deterministic seed, and optional checkpoint behavior. |
| Scenario controls | Cast count and whether additional cast entries are allowed. |
| Storage | Where structured run records and file artifacts are written. |
| Model roles | Which model configuration backs planning, actor generation, runtime coordination, final reporting, and repair. |
| Logging | Console verbosity and durable event-log behavior. |
| Analysis | Which summaries, tables, and visual artifacts are emitted for completed runs. |

## Runtime Controls

Runtime controls shape how far a simulation can advance.

- maximum rounds define the hard ceiling
- scene actor limits bound how many actors can participate in one runtime focus
- candidate limits bound how many possible actions are considered
- scene beat limits bound how much activity one round can adopt
- deterministic seeds support repeatable selection where the implementation allows it

The exact defaults may change, but each completed run should make the effective controls visible
through the manifest.

## Scenario Controls

Scenario controls are part of the scenario contract.

```text
---
num_cast: 6
allow_additional_cast: true
---
Scenario body starts here.
```

`num_cast` is required and must be a positive integer. `allow_additional_cast` is optional. When it
is false, the run should use exactly the requested cast size. When it is true or omitted, the plan
may include additional cast entries if the scenario requires them.

## Model Role Configuration

`simula` uses role-level model configuration.

The current roles are:

- planner
- generator
- coordinator
- observer
- repair

Each role should resolve to one concrete model configuration with its own temperature, token
budget, timeout, and provider-specific credentials or endpoint settings when needed.

Role separation allows different stages to use different model strengths while keeping product
contracts stable.

## Storage And Artifacts

Configuration should identify:

- where structured run records are stored
- where file artifacts are written
- whether checkpoint-like recovery data is enabled
- how repeated trials isolate their outputs

The file output root is conceptually separate from committed sample runs. `output/` is the live
workspace for generated artifacts. `output.samples/` contains reference runs checked into the
repository.

## Validation Rules

Configuration validation should fail explicitly when required values are missing or incompatible.

Examples:

- unknown setting names should be rejected
- model roles should resolve before a run starts
- storage settings should be validated before the run writes artifacts
- invalid scenario controls should stop the run before planning

## Related Docs

- scenario and artifact operations: [`operations.md`](./operations.md)
- model roles: [`llm.md`](./llm.md)
- artifact contracts: [`contracts.md`](./contracts.md)
