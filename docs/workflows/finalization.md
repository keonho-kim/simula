# Finalization Workflow

## Purpose

Finalization turns the completed runtime trace into stable report artifacts.

## Active Path

```mermaid
flowchart LR
    Start([START]) --> Anchor["resolve_timeline_anchor"]
    Anchor --> Artifacts["build_report_artifacts"]
    Artifacts --> Conclusion["write_conclusion_section"]
    Artifacts --> Timeline["write_timeline_section"]
    Artifacts --> Dynamics["write_actor_dynamics_section"]
    Artifacts --> Events["write_major_events_section"]
    Conclusion --> Render["render_and_persist_final_report"]
    Timeline --> Render
    Dynamics --> Render
    Events --> Render
    Render --> End([END])
```

## Node Responsibilities

### `resolve_timeline_anchor`

Uses a parser-first strategy:

1. parse explicit absolute date/time from the scenario when possible
2. extract partial hints when the scenario is incomplete
3. call the `observer` role only when inference is still needed

The output is always one required `TimelineAnchorDecision`.

This is the only active structured LLM contract in finalization.

### `build_report_artifacts`

Builds:

- `final_report`
- `simulation_log_jsonl`
- `report_projection_json`

The projection now includes both the final major-event snapshot and the recorded
`event_memory_history` needed to explain how those outcomes were reached.

This is a code-only node. It does not call an LLM.

### `write_conclusion_section`, `write_timeline_section`, `write_actor_dynamics_section`, `write_major_events_section`

Call the `observer` role with text prompts built from shared report prompt inputs.
Each section is validated and retried once if the first attempt violates local section rules.

### `render_and_persist_final_report`

Renders Markdown from the validated section strings and stores the final report artifact.

## Final Outputs

The finalization stage populates the public output surface used by the root graph:

- `final_report`
- `final_report_markdown`
- `simulation_log_jsonl`
- `stop_reason` (`""`, `no_progress`, or `simulation_done`)
- `errors`
