# Planning Workflow

Planning turns raw scenario text plus scenario controls into one compact execution plan.

## Active Path

```mermaid
flowchart LR
    Start([START]) --> Analysis["build_planning_analysis"]
    Analysis --> Outline["build_cast_roster_outline"]
    Outline --> Situation["build_situation"]
    Situation --> Catalog["build_action_catalog"]
    Catalog --> Coordination["build_coordination_frame"]
    Coordination --> Events["build_major_events"]
    Events --> Frame["assemble_execution_plan_frame"]
    Frame --> Chunks["prepare_plan_cast_chunks"]
    Chunks --> Cast["build_plan_cast_chunk"]
    Cast --> Assemble["assemble_execution_plan"]
    Assemble --> Finalize["finalize_plan"]
    Finalize --> End([END])
```

## Stage Responsibilities

### Field bundle nodes

Planning is split into small structured calls:

- `build_planning_analysis` sets the premise, timing policy, and `planned_max_rounds`.
- `build_cast_roster_outline` fixes stable cast ids and display names.
- `build_situation` and `build_action_catalog` create independent plan inputs.
- `build_coordination_frame` uses the fixed situation, cast outline, and action catalog.
- `build_major_events` uses only action types from the fixed action catalog.
- `build_plan_cast_chunk` expands cast outline chunks into full cast roster entries.

The parallel graph may run independent bundle nodes concurrently after their inputs are fixed.

### `finalize_plan`

Validates and saves the plan before generation starts.

Current validation includes:

- unique `cast_id`
- unique `display_name`
- cast roster count matches `scenario_controls`
- major-event ids are unique and non-empty
- major-event round windows stay within `planned_max_rounds`
- major-event participant ids exist in the cast roster
- major-event completion action types exist in the action catalog

## Stage Output

The final `plan` contains:

- `interpretation`
- `situation`
- `progression_plan`
- `action_catalog`
- `coordination_frame`
- `cast_roster`
- `major_events`

## Failure Behavior

Planning fails if any required bundle cannot be parsed, repaired, or validated.
