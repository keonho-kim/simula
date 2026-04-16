# Planning Workflow

## Purpose

Planning turns raw scenario text plus scenario controls into one compact execution plan that later
stages can reuse without reopening the full scenario every time.

## Active Path

```mermaid
flowchart LR
    Start([START]) --> Analysis["build_planning_analysis"]
    Analysis --> Plan["build_execution_plan"]
    Plan --> Finalize["finalize_plan"]
    Finalize --> End([END])
```

## Node Responsibilities

### `build_planning_analysis`

Generates `PlanningAnalysis` in one strict structured call. The bundle includes:

- `brief_summary`
- `premise`
- `time_scope`
- `public_context`
- `private_context`
- `key_pressures`
- `progression_plan`

It also writes `planned_max_rounds` into workflow state from
`planning_analysis.progression_plan.max_rounds`.

### `build_execution_plan`

Generates `ExecutionPlanBundle` from:

- raw scenario text
- the planning analysis JSON
- the configured round cap
- `scenario_controls.num_cast`
- `scenario_controls.allow_additional_cast`

The bundle contributes:

- `situation`
- `action_catalog`
- `coordination_frame`
- `cast_roster`
- `major_events`

`major_events` may be empty when the scenario does not imply a shared event track worth carrying
through runtime.

### `finalize_plan`

Builds the persisted `plan` payload and performs code-side validation before the runtime ever sees
the plan.

Current validation includes:

- unique `cast_id`
- unique `display_name`
- cast roster count matches `scenario_controls`
- each major event has a non-empty unique `event_id`
- each major event round window stays within `planned_max_rounds`
- each major event participant id exists in the cast roster

After validation, the node:

- saves the plan through the store
- writes a `plan_finalized` runtime log event

## Stage Output

The final `plan` stored in workflow state contains:

- `interpretation`
- `situation`
- `progression_plan`
- `action_catalog`
- `coordination_frame`
- `cast_roster`
- `major_events`

Important distinctions:

- `planned_max_rounds` is the planner-recommended target
- `max_rounds` is the configured hard ceiling from runtime settings

## Failure Policy

- planning analysis is strict
- execution plan generation is strict
- plan finalization fails fast on invalid cast or major-event structure

There is no silent fallback plan.
