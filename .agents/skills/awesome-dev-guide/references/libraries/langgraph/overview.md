# LangGraph Guidance

Use this folder when the change affects graph state, node boundaries, branching, parallel fan-out, streaming, persistence, or resumability.

## Version baseline used in this repo

- LangGraph lock version: `1.0.10`
- Checkpoint package baseline in this repo:
  - `langgraph-checkpoint==3.0.1`
  - `langgraph-checkpoint-postgres==3.0.4`
  - `langgraph-checkpoint-redis==0.3.6`
  - `langgraph-checkpoint-sqlite==3.0.3`

## When to read LangGraph guidance

Read this folder when you are changing:

- state keys
- node responsibilities
- branching conditions
- `Send`-based fan-out or fan-in reducers
- checkpoint behavior
- streaming behavior
- long-running or resumable execution

## Conceptual Design Standards

### Module assembly

- Assemble graphs at the module level.
- Keep a single entry instance.
- Lazily initialize only heavyweight dependencies.

### State objects

- Fix state as a `TypedDict`-based contract.
- Separate input keys, branch keys, intermediate outputs, and final output keys.
- Standardize a stable final response key and keep it consistent across nodes and stream contracts.

### Execution helpers

- Group compile, invoke, stream, and thread injection into a shared executor.
- Separate internal events from the external event contract.
- Handle static input merging in the executor.

### Separate function nodes from LLM nodes

- Handle classification, routing, dedup, collect, and top-k with function nodes.
- Use LLM nodes only for natural-language generation or uncertain judgment.
- For most LLM nodes other than response generation, prefer single-call execution.

### Conditional branching

1. A classifier node creates the raw result.
2. A route or finalize node normalizes the result.
3. Conditional edges branch only on normalized tokens.

### fan-out / fan-in

- Parallelize independent work with fan-out.
- Merge results back in a reducer or collect stage.
- Always enforce an input cap before fan-out.

### Streaming contracts

- Limit externally visible events through a policy map.
- Expose only policy/branch events and intermediate outputs with user value.
- Expose final natural-language output as `token` and `assistant_message`.

### Failure recovery

- Do not end failures only as exceptions.
- Recover them into state as step failures, candidate exclusions, or retry feedback.
- Separate recoverable failures from non-recoverable failures.

## Design Checklist

1. Did you standardize the final output key?
2. Did you separate raw LLM output from route tokens?
3. Did you add an input cap before fan-out?
4. Did you minimize the events shown externally?
5. Did you decide whether failures should be recovered into state?
6. Did you separate startup precomputed values from request-time computed values?
7. Did you verify whether injecting the full history is really necessary?

## Topic map

- `state-and-reducers.md`: state schema, reducer design, append vs overwrite semantics
- `parallelism-and-control-flow.md`: `Send`, conditional edges, `Command`, map-reduce
- `streaming.md`: stream modes, `get_stream_writer`, event-shape discipline
- `durable-execution.md`: replay-safe nodes, side-effect isolation, resumability
- `checkpointers-overview.md`: common checkpointer wiring and lifecycle rules
- `checkpoint-postgres.md`: durable production backend pattern
- `checkpoint-sqlite.md`: local or dev durable backend pattern
- `checkpoint-redis.md`: Redis durable backend pattern and shallow saver options

## Official sources

- https://docs.langchain.com/oss/python/langgraph/overview
- https://docs.langchain.com/oss/python/langgraph/use-graph-api
- https://docs.langchain.com/oss/python/langgraph/streaming
- https://docs.langchain.com/oss/python/langgraph/durable-execution
- https://docs.langchain.com/oss/python/langgraph/add-memory
- https://reference.langchain.com/python/langgraph/checkpoints/
