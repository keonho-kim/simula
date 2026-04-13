# Library and Framework Guide

A shared guidance set for framework and library decisions used in this repository.

This skill now focuses on reusable library knowledge rather than repository-specific implementation slices.

## Guide Contents

1. LangGraph concepts and primitives
2. FastAPI application structure and HTTP boundary rules
3. LangChain abstraction and provider guidance
4. FastMCP server and client guidance
5. platform adapter guidance
6. Pythonic module and resource patterns
7. design patterns and overengineering avoidance
8. response latency optimization

## Directory Layout

- `references/libraries/langgraph/`: graph concepts, execution primitives, streaming, HITL, durable execution, checkpointers
- `references/libraries/fastapi/`: application structure, dependencies, lifespan, streaming, testing
- `references/libraries/langchain/`: model abstraction, tool calling, structured output, MCP adapters, provider guides
- `references/libraries/fastmcp/`: MCP server and composition guidance
- `references/libraries/platform/`: DAP and Knowledge Lake integration guidance
- `references/libraries/design-patterns/`: creational, structural, behavioral patterns and pattern-selection guidance
- `references/libraries/performance/`: latency and throughput guidance
- `references/libraries/pythonic-way.md`: Pythonic structure and resource-handling guidance

## Where To Start

- Start with `references/libraries/langgraph/README.md` for graph primitives, state, and routing concerns
- Start with `references/libraries/fastapi/overview.md` for HTTP boundary or app lifecycle work
- Start with `references/libraries/langchain/overview.md` for model abstraction, tool calling, or provider portability
- Start with `references/libraries/fastmcp/overview.md` for MCP server or client composition
- Start with `references/libraries/design-patterns/index.md` for design pattern selection and avoidance
- Start with `references/libraries/performance/overview.md` for latency and throughput tuning

## Common Terms

| Term | Meaning |
| --- | --- |
| graph | an execution workflow assembled with `StateGraph` |
| node | a unit of work that takes state as input and returns part of the state |
| state | a `TypedDict`-based set of keys shared across nodes |
| branch | a conditional edge that decides the next node based on state values |
| fan-out | a pattern that expands one list input into many parallel tasks |
| fan-in | a pattern that merges parallel results back through a reducer or collect step |
| stream contract | a node/event policy that limits which events are exposed externally |
| TTFT | time to first token or first meaningful event |
| total latency | total time from request start to final response completion |

## Integration Perspective

- The LangGraph documents cover the graph execution model, state contracts, routing primitives, streaming, HITL, and durable execution.
- The FastAPI documents cover the HTTP boundary, dependency wiring, lifespan, response handling, and API testing.
- The LangChain documents cover model abstraction, structured output, tool calling, MCP consumption, and provider-specific behavior.
- The FastMCP documents cover server composition, tools/resources/prompts, transports, and LangChain interop.
- The platform documents cover DAP and Knowledge Lake integration concerns used in this repository.
- The design-pattern documents cover generic pattern guidance and overengineering avoidance.
- The performance guide organizes shared latency principles that can be reused across graph types.
- General structure guidance and pattern-placement guidance now live under `.agents/skills/our-best-dev-practices/references/`.
- Repository-specific overlays should live in dedicated repo overlay skills such as `.agents/skills/repo-architecture-overlay/`.
