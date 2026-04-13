# LangGraph SQLite Checkpointer

Use this file when you need durable local state in development, tests, or a lightweight single-node deployment.

## Standard implementation pattern

```python
from langgraph.checkpoint.sqlite import SqliteSaver

with SqliteSaver.from_conn_string("checkpoints.sqlite") as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
    result = graph.invoke(
        payload,
        config={"configurable": {"thread_id": "thread-123"}},
    )
```

## Async pattern

```python
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

async with AsyncSqliteSaver.from_conn_string("checkpoints.sqlite") as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
    result = await graph.ainvoke(
        payload,
        config={"configurable": {"thread_id": "thread-123"}},
    )
```

## Recommended do / don't

- Do use SQLite for local durable development and reproducible tests.
- Do keep the database file path explicit and under operational control.
- Do call `setup()` before first use.
- Do not treat SQLite as the default choice for high-concurrency multi-worker production workloads.
- Do not place the checkpoint file on ephemeral storage unless losing resume state is acceptable.

## Practical notes

- SQLite is the smallest step up from `InMemorySaver` when you want durable state without adding new infrastructure.
- If an application uses SQLite for both application data and checkpoints, keep those files and lifecycles conceptually separate.

## Official sources

- https://reference.langchain.com/python/langgraph/checkpoints/#langgraph.checkpoint.sqlite.SqliteSaver
- https://reference.langchain.com/python/langgraph/checkpoints/#langgraph.checkpoint.sqlite.aio.AsyncSqliteSaver
- https://docs.langchain.com/oss/python/langgraph/add-memory
