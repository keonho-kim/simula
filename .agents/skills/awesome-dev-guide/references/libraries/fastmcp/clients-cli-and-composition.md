# FastMCP Clients, CLI, And Composition

Use this file when the repository must consume an MCP server directly or compose multiple MCP surfaces.

## Standard implementation pattern

```python
from fastmcp import Client

async with Client("http://localhost:8000/mcp") as client:
    tools = await client.list_tools()
    result = await client.call_tool("summarize", {"text": "hello"})
```

## Confirmed client surface in the installed version

- `list_tools`
- `list_resources`
- `read_resource`
- `list_prompts`
- `get_prompt`
- `call_tool`

## Composition guidance

- Use `mount` when one FastMCP server should expose another server as part of a larger surface.
- Use `as_proxy` when the server should forward an upstream MCP surface instead of re-implementing it.
- Keep namespacing and ownership explicit when composing multiple servers.

## Recommended do / don't

- Do inspect the tool and resource catalog before writing orchestration logic.
- Do keep composition shallow and understandable.
- Do avoid one monolithic “platform MCP server” unless ownership is actually centralized.
- Do not proxy or mount servers without deciding how auth, errors, and naming should flow.

## Practical notes

- If an application is both an MCP producer and consumer, keep those roles in separate modules even if they use the same FastMCP dependency.
- Prefer composition over copy-pasting the same tool definitions into multiple server entrypoints.

## Official sources

- https://gofastmcp.com/python-sdk/clients
- https://gofastmcp.com/python-sdk/fastmcp-server
