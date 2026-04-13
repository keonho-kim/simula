# FastMCP Guidance

Use this folder when the change involves building or consuming an MCP server directly, defining MCP tools/resources/prompts, or choosing MCP transports and auth patterns.

## Version baseline used in this repo

- FastMCP lock version: `3.0.2`
- The guidance below assumes the current Python SDK shape with `FastMCP` and `Client` as top-level exports.

## When to read FastMCP guidance

Read this folder when you are deciding:

- whether the repository should expose an MCP server directly
- how to model an MCP capability as a tool, resource, or prompt
- whether to use stdio or HTTP transport
- how to apply auth and authorization to an MCP surface
- how a FastMCP server should be consumed by LangChain or another MCP client

## Selection notes

- Use FastMCP when the application itself must expose or host an MCP server or needs a first-class MCP client.
- Use adapter libraries when a workflow only needs to consume MCP capabilities and a local FastMCP server would add unnecessary surface area.
- Keep MCP surface design close to the integration boundary. Do not leak transport decisions into domain logic.

## Topic map

- `server-basics.md`: server creation, typed tools, lifecycle basics
- `tools-resources-prompts.md`: how to choose the right MCP primitive
- `transports-and-auth.md`: stdio, streamable HTTP, auth, authorization
- `clients-cli-and-composition.md`: `Client`, inspection, mounting, proxying, composition
- `langchain-interop.md`: how to consume a FastMCP server from LangChain cleanly

## Official sources

- https://gofastmcp.com/python-sdk/fastmcp-server
- https://gofastmcp.com/python-sdk/clients
- https://gofastmcp.com/python-sdk/transports
- https://gofastmcp.com/python-sdk/auth
