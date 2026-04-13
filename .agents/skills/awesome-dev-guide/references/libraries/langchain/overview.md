# LangChain Guidance

Use this folder when you need higher-level LLM application building blocks, model abstraction, tool calling, structured output, or MCP consumption.

## Version baseline used in this repo

- `langchain==1.2.10`
- `langchain-openai==1.1.10`
- `langchain-anthropic==1.3.4`
- `langchain-google-genai==4.2.1`
- `langchain-mcp-adapters==0.2.1`

## When to read LangChain guidance

Use this folder when:

- you need model abstraction across providers
- you need tool-calling or structured output patterns
- you need MCP tools, resources, or prompts inside a LangChain workflow
- you need to decide whether a feature should be a LangChain abstraction, a LangGraph node, or a thin provider wrapper

## Selection notes

- If a change is about graph execution flow, state transitions, checkpointing, or resumability, read the LangGraph folder first.
- If a change is about model invocation shape, tool binding, structured output, or provider portability, start here.
- Add LangChain abstractions only when they simplify a real model or tool concern that already exists.
- For vLLM, the default LangChain path is `langchain_openai.ChatOpenAI` against the vLLM OpenAI-compatible server. Read `provider-vllm.md` when the deployment is concretely vLLM, especially if request extensions or non-standard response fields matter.

## Topic map

- `model-selection.md`: `init_chat_model` versus provider-specific classes
- `tool-calling-and-structured-output.md`: `bind_tools`, structured output, agent vs explicit graph node
- provider files: standard patterns for OpenAI, Anthropic, Google GenAI, and vLLM
- `provider-vllm.md`: OpenAI-compatible vLLM usage through `ChatOpenAI`, `base_url`, `api_key`, `extra_body`, and deployment-specific compatibility cautions
- `mcp-adapters.md`: MCP server consumption through `MultiServerMCPClient` and loaders

## Official sources

- https://docs.langchain.com/oss/python/langchain/overview
- https://docs.langchain.com/oss/python/langchain/models
- https://docs.langchain.com/oss/python/langchain/tools
- https://docs.langchain.com/oss/python/langchain/agents
- https://docs.langchain.com/oss/python/langchain/structured-output
- https://docs.langchain.com/oss/python/langchain/mcp
