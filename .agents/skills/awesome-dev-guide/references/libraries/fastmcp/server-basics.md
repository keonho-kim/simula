# FastMCP Server Basics

Use this file when creating a new FastMCP server or adding the first tool to an existing one.

## Standard implementation pattern

```python
from fastmcp import FastMCP

mcp = FastMCP("chatbot-tools")

@mcp.tool
def summarize(text: str) -> str:
    """Summarize user text in one short paragraph."""
    return text[:200]
```

## Recommended do / don't

- Do use typed function signatures and useful docstrings.
- Do keep each tool small, named by intent, and easy to authorize.
- Do keep server construction in one import-stable module.
- Do not bury transport or auth setup in unrelated utility modules.
- Do not expose one giant “do everything” tool when several small tools are safer.

## Practical notes

- If an application gains a FastMCP server, keep it in the integration layer or a clearly named server package.
- Tool handlers should call existing application services instead of re-implementing business logic.
- Preserve the same logging and exception boundaries used by HTTP and graph integrations.

## Compatibility notes

- In the installed version, `FastMCP` exposes `tool`, `resource`, `prompt`, `mount`, `http_app`, `as_proxy`, and `auth`-related capabilities on the server object.

## Official sources

- https://gofastmcp.com/python-sdk/fastmcp-server
