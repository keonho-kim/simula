# Planning Workflow

## Purpose

Planning turns raw scenario text into one compact execution plan that downstream stages can use
without reopening the original scenario every time.

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

Generates `PlanningAnalysis` in one structured call. This bundle captures:

- brief summary
- premise
- time scope
- public context
- private context
- key pressures
- observation points
- progression plan

### `build_execution_plan`

Generates `ExecutionPlanBundle` from the planning analysis. This bundle contains:

- `situation`
- `action_catalog`
- `coordination_frame`
- `cast_roster`

### `finalize_plan`

Builds the persisted plan payload, validates cast uniqueness, and writes the plan to storage.

## Stage Output

The final `plan` retained in workflow state contains only the keys used downstream:

- `interpretation`
- `situation`
- `progression_plan`
- `action_catalog`
- `coordination_frame`
- `cast_roster`
