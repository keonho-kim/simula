# LangGraph Redis Checkpointer

Use this file when Redis is already part of the architecture and you want durable checkpoint state with low-latency access.

## Standard implementation pattern

```python
from langgraph.checkpoint.redis import RedisSaver

REDIS_URI = "redis://localhost:6379/0"

with RedisSaver.from_conn_string(REDIS_URI) as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
    result = graph.invoke(
        payload,
        config={"configurable": {"thread_id": "thread-123"}},
    )
```

## Async pattern

```python
from langgraph.checkpoint.redis import AsyncRedisSaver

async with AsyncRedisSaver.from_conn_string(REDIS_URI) as checkpointer:
    await checkpointer.asetup()
    graph = builder.compile(checkpointer=checkpointer)
    result = await graph.ainvoke(
        payload,
        config={"configurable": {"thread_id": "thread-123"}},
    )
```

## Recommended do / don't

- Do run `setup()` or `asetup()` before first use.
- Do verify the Redis deployment matches the package requirements before choosing this backend for production.
- Do consider shallow saver variants when only the latest checkpoint matters.
- Do not assume every Redis deployment is compatible without checking module and indexing requirements from the package docs.
- Do not put checkpoint durability on a cache tier that may evict data unexpectedly.

## Practical notes

- Redis is a good fit when the broader system already uses Redis and the team wants shared operational tooling.
- If checkpoint history depth is not useful, prefer a shallow saver explicitly rather than silently pruning on your own.

## Compatibility notes

- The package exposes `RedisSaver`, `AsyncRedisSaver`, `ShallowRedisSaver`, and `AsyncShallowRedisSaver`.
- Use the shallow variants only when “latest snapshot only” is the intended durability contract.

## Official sources

- https://pypi.org/project/langgraph-checkpoint-redis/
- https://docs.langchain.com/oss/python/langgraph/add-memory
