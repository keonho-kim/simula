# LangChain Tool Calling And Structured Output

Use this file when the model must call tools, return validated structured data, or graduate from a simple prompt call into an explicit orchestration pattern.

## Standard implementation pattern

- Use typed, explicit tools.
- Bind tools with `bind_tools(...)` only where tool calling is actually part of the contract.
- Use `with_structured_output(...)` when downstream code needs validated structure rather than free-form text.
- Use a full agent loop only when the workflow genuinely needs iterative model-tool reasoning.
- Prefer an explicit LangGraph node over a full agent when one model call and one tool phase are enough.

## Recommended do / don't

- Do keep tool boundaries explicit and typed.
- Do prefer a small static tool set before dynamic discovery.
- Do choose structured output when the next layer needs a schema, route, or machine-readable decision.
- Do not simulate tool use with prompt-only instructions when real tools are available.
- Do not add a full agent loop where a single graph node or deterministic tool call is enough.

## Practical notes

- Favor explicit workflow and node design when a full agent loop is not required.
- If a node needs tool calling, keep the tool contract stable and typed, then emit a compact result back into state.
- If a route only needs a classification or schema-shaped decision, prefer structured output over parsing raw free text.

## Official sources

- https://docs.langchain.com/oss/python/langchain/tools
- https://docs.langchain.com/oss/python/langchain/structured-output
- https://docs.langchain.com/oss/python/langchain/agents
