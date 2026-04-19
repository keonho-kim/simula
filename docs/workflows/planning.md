# Planning Workflow

Planning turns raw scenario text plus scenario controls into one compact execution plan that later
stages can reuse without reopening the full scenario every time.

## Active Path

```mermaid
flowchart LR
    Start([START]) --> Analysis["build_planning_analysis"]
    Analysis --> Outline["build_cast_roster_outline"]
    Outline --> Frame["build_execution_plan_frame"]
    Frame --> Chunks["plan cast chunk expansion"]
    Chunks --> Assemble["assemble_execution_plan"]
    Assemble --> Finalize["finalize_plan"]
    Finalize --> End([END])
```

## Stage Responsibilities

### `build_planning_analysis`

Builds the planning summary:

- `brief_summary`
- `premise`
- `time_scope`
- `key_pressures`
- `progression_plan`

It also sets `planned_max_rounds` from `planning_analysis.progression_plan.max_rounds`.

### `build_cast_roster_outline`

Builds the minimal cast outline used by the rest of planning.

### `build_execution_plan_frame`

Builds the shared planning frame from:

- raw scenario text
- the planning analysis JSON
- the configured round cap
- `scenario_controls.num_cast`
- `scenario_controls.allow_additional_cast`

The frame contributes:

- `situation`
- `action_catalog`
- `coordination_frame`
- `major_events`

These bundles stay deliberately compact:

- `action_catalog` stores only broad action options with `action_type`, `label`,
  `description`, `supported_visibility`, and `requires_target`
- `coordination_frame` stores only `focus_policy`, `background_policy`, and
  `max_focus_actors`
- `major_events` stores compact checkpoints with `must_resolve` instead of older
  scenario-specific completion flags

`major_events` may be empty when the scenario does not imply a shared event track worth carrying
through runtime.

### `plan cast chunk expansion`

Expands the cast outline into full cast-roster items, one chunk at a time in serial mode or
concurrently when `--parallel` is enabled.

### `assemble_execution_plan`

Merges the execution-plan frame and generated cast chunks into the final plan payload.

### `finalize_plan`

Validates the final plan and saves it before runtime starts.

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

Inside `interpretation`, the planning summary remains compact:

- `brief_summary`
- `premise`
- `time_scope`
- `key_pressures`

Important distinctions:

- `planned_max_rounds` is the planner-recommended target
- `max_rounds` is the configured hard ceiling from runtime settings

## Failure Behavior

Planning fails if the required plan structure cannot be produced or validated.
