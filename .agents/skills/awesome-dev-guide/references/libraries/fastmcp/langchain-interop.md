# FastMCP And LangChain Interop

Use this file when the repository builds an MCP server with FastMCP and consumes it from LangChain.

## Standard implementation pattern

- Build the MCP surface with FastMCP.
- Keep tool, resource, and prompt contracts clean and typed.
- Consume that surface from LangChain through `langchain-mcp-adapters`.
- Let LangChain own model orchestration and let FastMCP own protocol exposure.

## Recommended do / don't

- Do treat FastMCP as the server framework and LangChain as the consumer or orchestrator.
- Do keep transport, headers, and auth explicit at the MCP boundary.
- Do keep MCP capability names stable because LangChain will surface them directly to tools or prompts.
- Do not duplicate the same business operation as both a local LangChain tool and a remote MCP tool without a clear reason.
- Do not let orchestration concerns leak back into the FastMCP server layer.

## Practical notes

- If an application serves tools to outside clients and also uses some of those tools internally through LangChain, define the MCP surface once and consume it rather than maintaining parallel catalogs.
- If the consumer path is stateful, keep MCP client lifecycle and session ownership explicit in the integration layer.

## Official sources

- https://gofastmcp.com/python-sdk/fastmcp-server
- https://gofastmcp.com/python-sdk/clients
- https://docs.langchain.com/oss/python/langchain/mcp
- https://reference.langchain.com/python/langchain_mcp_adapters/
