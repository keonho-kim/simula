# LangGraph Postgres Checkpointer

Use this file when you need a durable production-grade checkpointer.

## Standard implementation pattern

```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://user:password@host:5432/dbname?sslmode=disable"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
    result = graph.invoke(
        payload,
        config={"configurable": {"thread_id": "thread-123"}},
    )
```

## Async pattern

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async with AsyncPostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
    result = await graph.ainvoke(
        payload,
        config={"configurable": {"thread_id": "thread-123"}},
    )
```

## Recommended do / don't

- Do call `setup()` before first real use.
- Do keep the saver lifecycle outside hot request code.
- Do prefer Postgres when you need durable history and operationally standard infrastructure.
- Do not create one connection-backed saver per request.
- Do not change the thread identity scheme without a migration plan for resume behavior.

## Practical notes

- Postgres is the safest next step when an application needs durable resume semantics in multi-process or deployed environments.
- Wire the saver through one API runtime owner or lifespan-managed service, then hand the compiled graph downward.

## Compatibility notes

- The package also exposes shallow saver variants. Use them only when you intentionally want latest-checkpoint semantics instead of full history.

## Official sources

- https://reference.langchain.com/python/langgraph/checkpoints/#langgraph.checkpoint.postgres.PostgresSaver
- https://reference.langchain.com/python/langgraph/checkpoints/#langgraph.checkpoint.postgres.aio.AsyncPostgresSaver
- https://docs.langchain.com/oss/python/langgraph/add-memory
