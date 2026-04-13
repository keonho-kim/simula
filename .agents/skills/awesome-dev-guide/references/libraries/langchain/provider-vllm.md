# LangChain vLLM Integration

Use this file when the repository needs to call a vLLM server from LangChain.

## Standard implementation pattern

The standard LangChain pattern is to use `langchain_openai.ChatOpenAI` against the vLLM OpenAI-compatible endpoint.

```python
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model="meta-llama/Llama-3.1-8B-Instruct",
    base_url="http://localhost:8000/v1",
    api_key="dummy",
    temperature=0,
)
```

The `model` value should match the served model name exposed by the vLLM server, not an OpenAI-hosted model id by assumption.

If the deployment needs vLLM-specific request controls, pass them at the integration boundary with `extra_body=...` rather than leaking them into graph or domain code.

```python
model = ChatOpenAI(
    model="meta-llama/Llama-3.1-8B-Instruct",
    base_url="http://localhost:8000/v1",
    api_key="dummy",
    temperature=0,
    extra_body={"top_k": 40},
)
```

## Recommended do / don't

- Do treat vLLM as an OpenAI-compatible transport unless the deployment explicitly exposes a different contract.
- Do keep `base_url`, `api_key`, and served model IDs centralized.
- Do validate JSON mode, tool calling, structured output, and streaming support against the actual hosted model and server configuration.
- Do assume capability contracts are deployment-specific: model family, tokenizer, served model alias, and vLLM server flags all matter.
- Do use `extra_body` only from the integration layer when vLLM-specific request knobs are required.
- Do not assume feature parity with OpenAI-hosted models just because the transport is compatible.
- Do not assume non-standard vLLM response fields will be preserved by `ChatOpenAI` unless you explicitly verify that path.

## Practical notes

- If an application adds vLLM, the cleanest path is usually an integration-layer factory that still returns the standard LLM wrapper used by the rest of the system.
- Avoid creating a separate domain-level abstraction just for “self-hosted OpenAI-compatible model”. The transport difference belongs in the integration layer.
- If the feature depends on a vLLM-only knob or response field, document that coupling inside the integration wrapper or design note instead of hiding it behind a generic “OpenAI-compatible” label.

## Compatibility notes

- LangChain's recommended vLLM path currently goes through `langchain_openai`, not a separate vLLM-only chat wrapper.
- OpenAI-compatible transport does not guarantee OpenAI feature parity. Tool calling, JSON mode, response-format behavior, and streaming details must be validated against the actual vLLM deployment.
- If the application needs vLLM-specific response metadata or extension fields, treat that as an integration-layer concern. Do not assume `ChatOpenAI` will surface every non-standard field without extra handling.

## Official sources

- https://docs.langchain.com/oss/python/integrations/chat/vllm
- https://docs.langchain.com/oss/python/integrations/chat/openai
- https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html
