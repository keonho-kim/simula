# LangGraph Parallelism And Control Flow

Use this file when the graph must branch dynamically, fan out work in parallel, or combine multiple branch results.

## Standard implementation pattern

- Use conditional edges for simple one-of-many routing.
- Use `Send` for map-style fan-out where one node schedules many copies of a target node with different inputs.
- Use reducer-backed state keys to aggregate parallel outputs.
- Use `Command` when a node must update state and choose the next route in one explicit return value.

## `Send` guidance

- `Send` is the standard LangGraph mechanism for parallel fan-out.
- A routing node should validate the list it will fan out over, then return a list of `Send(target_node, payload)` values.
- The target node should process exactly one unit of work and return a partial state update.
- A reducer should merge those partial updates into a collection or aggregate key.

## Recommended do / don't

- Do make the fan-out input list explicit in state.
- Do keep target nodes small and independent.
- Do plan the reduce key before introducing `Send`.
- Do not write many parallel workers into the same scalar key without a reducer.
- Do not mix business routing and list validation across many nodes when one router can own it.

## Practical notes

- If your codebase already has a shared helper around the standard `Send` pattern, prefer reusing it for the common “list of items -> same target node -> reducer-backed collector” shape.
- If a route can fall back to a default sequential path, keep that fallback explicit instead of returning an empty `Send` list.

## Compatibility notes

- `Command` is useful when a node both computes new state and decides the next edge. Prefer it over ad hoc multi-node route bookkeeping when it reduces ambiguity.
- Parallelism improves latency only if the downstream work is actually independent and the reducer key is well defined.

## Official sources

- https://docs.langchain.com/oss/python/langgraph/use-graph-api
