# FastMCP Tools, Resources, And Prompts

Use this file when deciding how an MCP capability should be modeled.

## Choose the right primitive

- Use a tool for an action or computation the client actively calls.
- Use a resource for read-oriented data or context retrieval.
- Use a prompt when the server should publish reusable prompt templates instead of immediately executing work.

## Standard implementation pattern

- Keep tools side-effectful only when the action is intentional and auditable.
- Keep resources read-oriented and stable.
- Keep prompts reusable and parameterized only where the template shape is stable.
- Prefer several small MCP primitives over one overloaded handler with many modes.

## Recommended do / don't

- Do model retrieval-like data as resources when the caller benefits from read semantics.
- Do keep prompts as templates, not as hidden execution backdoors.
- Do keep tool input schemas obvious and typed.
- Do not publish internal-only data as resources just because it is easy.
- Do not turn every resource into a tool unless the consuming runtime truly needs tool semantics.

## Practical notes

- If LangChain is the consumer, only lift resources or prompts into tool form when the agent path genuinely needs that abstraction.
- If the capability already exists as an application service, wrap that capability once instead of creating parallel logic for tool, resource, and prompt variants.

## Official sources

- https://gofastmcp.com/python-sdk/fastmcp-server
- https://gofastmcp.com/python-sdk/clients
