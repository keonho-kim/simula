# LangGraph Checkpointers Overview

Use this file when selecting a checkpoint backend or wiring a graph for resumability.

## Version baseline used in this repo

- `langgraph-checkpoint==3.0.1`
- `langgraph-checkpoint-postgres==3.0.4`
- `langgraph-checkpoint-redis==0.3.6`
- `langgraph-checkpoint-sqlite==3.0.3`

## Standard implementation pattern

- Choose a saver class.
- Initialize it once.
- Call `setup()` or `asetup()` when the backend requires first-time schema or index initialization.
- Compile the graph with `graph.compile(checkpointer=saver)`.
- Invoke or stream the graph with a stable `configurable.thread_id`.

## Runtime config keys that matter

- `thread_id`: the primary durable identity for one resumable execution thread
- `checkpoint_ns`: use when one logical thread needs multiple checkpoint namespaces
- `checkpoint_id`: use when you must address a specific checkpoint directly

## Common backend choices

- `InMemorySaver`: tests, toy flows, single-process development
- `PostgresSaver`: primary durable production backend
- `SqliteSaver`: local durable development or lightweight single-node persistence
- `RedisSaver`: durable fast store when Redis is already part of the architecture
- shallow saver variants: keep only the latest checkpoint when full checkpoint history is unnecessary

## Recommended do / don't

- Do create one saver instance per app lifecycle or dependency container, not per request.
- Do run backend setup once during provisioning or startup.
- Do define how `thread_id` is chosen before shipping resumable flows.
- Do not change saver type casually without checking resume behavior, cleanup behavior, and operational ownership.
- Do not hide checkpoint setup inside hot request paths.

## Practical notes

- `InMemorySaver` is fine for simple local flows, but it does not provide durable resume across process restarts.
- If you upgrade to a durable saver, the HTTP or job layer must define a stable mapping from user-facing work to `thread_id`.
- Keep checkpoint IDs and user-facing session IDs conceptually separate unless they are intentionally unified.

## Official sources

- https://docs.langchain.com/oss/python/langgraph/add-memory
- https://reference.langchain.com/python/langgraph/checkpoints/
