# LangGraph Reference Index

An index for quickly finding LangGraph design and SDK usage points by question type.

## Which Document To Read First

- Read `overview.md` if you need graph structure, state contracts, branching, or fan-out
- Read `graph-core.md` if you need `StateGraph`, `START`, `END`, or node/edge assembly
- Read `execution.md` if you need `Send`, `Command`, reducers, checkpointers, `thread_id`, or durability
- Read `streaming.md` if you need stream modes, `get_stream_writer`, or external event contracts
- Read `hitl-primitives.md` if you need `interrupt`, resume, or replay-safe side effects
- Read `hitl.md` if you need approval, editing, resumption, or `interrupt`-based human intervention

## Skill Usage Rules

- Use `overview.md` for conceptual design
- Use `graph-core.md` for graph assembly primitives
- Use `execution.md` for execution and state transitions
- Use `streaming.md` for streaming
- Use `hitl-primitives.md` for HITL primitives
- Use `hitl.md` for HITL and resume policy
