# FastMCP Transports And Auth

Use this file when deciding how an MCP server should be exposed and protected.

## Standard transport choices

- Use stdio for local tool integration, desktop apps, or editor-hosted processes.
- Use streamable HTTP when the server must be reachable over the network or mounted into a web stack.
- Prefer the modern HTTP transport path from the official docs over inventing a custom bridge.

## Standard auth pattern

- Attach auth at the server boundary.
- Keep authorization decisions close to tool or resource ownership.
- Pass auth material through the chosen transport deliberately instead of hiding it in unrelated client helpers.
- Keep transport and auth configuration in the server entrypoint or the server factory, not in individual tool bodies.

## Recommended do / don't

- Do choose the transport based on deployment shape and client expectations.
- Do separate authentication from business logic.
- Do keep per-tool authorization explicit when the tool catalog mixes risk levels.
- Do not expose a remote MCP surface without deciding how clients authenticate.
- Do not encode auth assumptions in prompt text or tool descriptions.

## Practical notes

- If the application already has FastAPI or another ASGI surface, a mounted HTTP app can be cleaner than running a second unrelated process tree.
- If the server is only serving local IDE or CLI integrations, stdio is usually the simpler default.
- When a remote server is required, prefer one clearly owned streamable HTTP surface over several ad hoc MCP endpoints.

## Compatibility notes

- In the installed FastMCP version, the server object exposes `http_app` and `auth` capabilities. Use those first instead of building a custom wrapper layer.
- Keep transport selection independent from business capability selection. The same tool catalog may be valid over stdio or HTTP.

## Official sources

- https://gofastmcp.com/python-sdk/transports
- https://gofastmcp.com/python-sdk/auth
- https://gofastmcp.com/python-sdk/fastmcp-server
