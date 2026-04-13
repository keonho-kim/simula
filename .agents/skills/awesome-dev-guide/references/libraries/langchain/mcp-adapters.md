# LangChain MCP Adapters

Use this file when LangChain must consume tools, resources, or prompts exposed by MCP servers.

## Version baseline used in this repo

- `langchain-mcp-adapters==0.2.1`
- Confirmed public helpers in the installed package:
  - `MultiServerMCPClient`
  - `load_mcp_tools`
  - `load_mcp_resources`
  - `load_mcp_prompt`

## Standard implementation pattern

```python
from langchain_mcp_adapters.client import (
    MultiServerMCPClient,
    load_mcp_prompt,
    load_mcp_resources,
    load_mcp_tools,
)

client = MultiServerMCPClient(
    {
        "filesystem": {
            "transport": "stdio",
            "command": "python",
            "args": ["server.py"],
        },
        "remote": {
            "transport": "streamable_http",
            "url": "https://example.com/mcp",
            "headers": {"Authorization": "Bearer <token>"},
        },
    }
)

tools = load_mcp_tools(client)
resources = load_mcp_resources(client)
prompt = load_mcp_prompt(client, "summarize")
```

## What to load

- Load tools when the model should call remote actions.
- Load resources when the application wants read-oriented remote context with explicit resource access.
- Load prompts when MCP is the source of reusable prompt templates.

## Session and transport guidance

- Use one long-lived client when the server keeps state across calls.
- Short-lived clients are fine for purely stateless servers.
- Prefer stdio for local process-backed MCP servers.
- Prefer `streamable_http` for remote or service-hosted MCP servers.
- Pass headers and auth at client construction time so the contract is obvious.

## Recommended do / don't

- Do keep the MCP client lifecycle explicit.
- Do choose long-lived clients when the server is stateful or session-oriented.
- Do pass headers or auth configuration at the MCP transport boundary, not scattered across tool wrappers.
- Do keep the LangChain-visible MCP catalog intentionally small.
- Do not hide stateful MCP sessions behind short-lived helper functions if session continuity matters.
- Do not flatten tools, resources, and prompts into one abstraction if the caller benefits from the distinction.

## Practical notes

- If LangChain is only the MCP consumer and another orchestration layer still owns control flow, keep the MCP client in the integration boundary and pass the loaded tools or prompt handles downward.
- If a graph node calls MCP tools, keep the node contract explicit: which tools are available, what output shape is expected, and how failures are surfaced.
- Prefer `MultiServerMCPClient` when several MCP servers must be presented as one tool catalog.
- If the MCP surface is large, build a small application-owned loader that selects only the tools, resources, or prompts needed by that feature.

## Compatibility notes

- The installed package also exposes conversion helpers in `langchain_mcp_adapters.tools`, including `convert_mcp_tool_to_langchain_tool` and `to_fastmcp`.
- Keep tool catalogs small. A large MCP catalog can easily become an accidental implicit agent surface.
- If a future LangChain release adds richer MCP middleware or interceptors, treat that as an integration-layer concern rather than embedding it inside graph nodes.

## Official sources

- https://docs.langchain.com/oss/python/langchain/mcp
- https://reference.langchain.com/python/langchain_mcp_adapters/
