---
name: awesome-dev-guide
description: Use this skill when choosing or applying framework and library guidance for LangGraph, FastAPI, LangChain, FastMCP, platform adapters, Pythonic module structure, performance tuning, or design patterns in this repository.
---

# Awesome Dev Guide

Use this skill when the task is about framework-level or library-level guidance, not repository-specific placement or graph-type implementation slicing.

This skill provides shared guidance for:

- LangGraph primitives and execution model
- streaming and HITL design
- FastAPI boundary and application structure
- LangChain abstractions and provider guidance
- FastMCP server and composition guidance
- platform adapter guidance
- Pythonic module and resource patterns
- design patterns and overengineering avoidance
- latency and throughput tuning

## Start Here

1. Read `README.md` for the overall map of the guide.
2. Open only the smallest set of files that match the task.

## Which Files To Read

### If the task is about graph structure, state, edges, fan-out, reducers, checkpoints, or resumability

Read:

- `references/libraries/langgraph/README.md`
- `references/libraries/langgraph/overview.md`
- `references/libraries/langgraph/graph-core.md`
- `references/libraries/langgraph/execution.md`

### If the task is about streaming contracts, intermediate events, or external event shape

Read:

- `references/libraries/langgraph/README.md`
- `references/libraries/langgraph/streaming.md`

### If the task is about approvals, review steps, interrupt/resume, or other human-in-the-loop behavior

Read:

- `references/libraries/langgraph/hitl-primitives.md`
- `references/libraries/langgraph/hitl.md`

### If the task is about response speed, batch execution, candidate pruning, or tail latency

Read:

- `references/libraries/performance/overview.md`

### If the task is about FastAPI structure, dependencies, lifespan, error mapping, streaming responses, or API tests

Read:

- `references/libraries/fastapi/overview.md`
- `references/libraries/fastapi/application-structure.md`
- `references/libraries/fastapi/dependencies-and-lifespan.md`
- `references/libraries/fastapi/errors-responses-and-streaming.md`
- `references/libraries/fastapi/testing.md`

### If the task is about LangChain abstraction, model selection, provider behavior, tool calling, or MCP consumption

Read:

- `references/libraries/langchain/overview.md`
- `references/libraries/langchain/model-selection.md`
- `references/libraries/langchain/tool-calling-and-structured-output.md`
- the provider-specific file under `references/libraries/langchain/`
- `references/libraries/langchain/mcp-adapters.md`

### If the task is about FastMCP server design, tools/resources/prompts, transport, or LangChain interop

Read:

- `references/libraries/fastmcp/overview.md`
- `references/libraries/fastmcp/server-basics.md`
- `references/libraries/fastmcp/tools-resources-prompts.md`
- `references/libraries/fastmcp/transports-and-auth.md`
- `references/libraries/fastmcp/langchain-interop.md`

### If the task is about DAP, Knowledge Lake, or platform adapter behavior

Read:

- `references/libraries/platform/overview.md`
- the relevant file under `references/libraries/platform/`

### If the task is about Python module structure, interfaces, resource ownership, or readable implementation boundaries

Read:

- `references/libraries/pythonic-way.md`

### If the task is about design patterns, extension structure, or avoiding unnecessary abstractions

Read:

- `references/libraries/design-patterns/index.md`
- `references/libraries/design-patterns/creational.md`
- `references/libraries/design-patterns/structural.md`
- `references/libraries/design-patterns/behavioral.md`
- `references/libraries/design-patterns/avoid.md`

## Working Rules

- Read only the sections needed for the current question or change.
- Start from the library overview or index docs before reading deeper detail.
- Prefer framework primitives and stable contracts over abstract architectural discussion.
- Use the design-pattern files to simplify a solution, not to justify adding more abstraction.
- If the task becomes layer-placement-specific, pattern-placement-specific, or graph-type-specific, switch to `.agents/skills/our-best-dev-practices/SKILL.md`.
- If the task depends on the current repository's local layout or protected workflow files, also read `.agents/skills/repo-architecture-overlay/SKILL.md`.
