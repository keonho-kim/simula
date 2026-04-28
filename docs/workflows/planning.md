# Planning Workflow

Planning turns scenario text and controls into data that later stages can use without rereading the
full source brief.

## Responsibilities

Planning builds:

- scenario digest
- major events
- action catalog
- actor roster
- background story and runtime direction

The planner role produces compact stage outputs that are validated before actor generation starts.

## Scenario Controls

Planning respects:

- `numCast`
- `allowAdditionalCast`
- `actionsPerType`
- `maxRound`
- prompt `language`

`allowAdditionalCast: false` requires the final roster to match `numCast`. When true, the planner
may include additional actors if the scenario needs them.

## Stage Output

The plan is stored in workflow state and later persisted inside `state.json`.

It includes:

- interpretation and digest fields
- action catalog
- major events
- actor roster entries

## Failure Behavior

Planning fails when required structured data cannot be recovered or validated. The server records
that failure through `run.failed`.

## Related Docs

- contracts: [`../contracts.md`](../contracts.md)
- actor generation: [`generation.md`](./generation.md)
