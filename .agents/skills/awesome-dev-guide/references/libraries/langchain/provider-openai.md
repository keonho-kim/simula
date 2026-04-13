# LangChain OpenAI Integration

Use this file when the repository needs OpenAI-hosted chat models or an OpenAI-compatible API surface.

If the concrete target is vLLM, read `provider-vllm.md` as well. That file captures the repo's vLLM-specific cautions and `extra_body` guidance.

## Standard implementation pattern

```python
from langchain_openai import ChatOpenAI

model = ChatOpenAI(
    model="gpt-4.1-mini",
    temperature=0,
)
```

For OpenAI-compatible servers:

```python
model = ChatOpenAI(
    model="your-model-name",
    base_url="http://localhost:8000/v1",
    api_key="dummy-or-real-key",
    temperature=0,
)
```

## Recommended do / don't

- Do use `ChatOpenAI` when the provider API is OpenAI-native or OpenAI-compatible.
- Do keep `base_url`, auth, and model ID in one integration boundary.
- Do use streaming or structured output only when the caller needs them.
- Do not assume every OpenAI-compatible server supports every OpenAI feature equally.
- Do not scatter OpenAI-specific options across graph nodes.

## Practical notes

- If OpenAI becomes a new provider, wire it through one LLM integration wrapper rather than exposing `ChatOpenAI` directly to every node.
- Reuse one consistent logging and exception wrapper pattern around the chat model instance.

## Compatibility notes

- `ChatOpenAI` is also the standard LangChain entry point for OpenAI-compatible providers such as vLLM. Capability differences belong in configuration notes, not in duplicated wrappers.
- For vLLM specifically, prefer the dedicated `provider-vllm.md` note over treating it as a generic compatibility footnote.
- Some OpenAI-compatible backends expose non-standard fields or extensions that `ChatOpenAI` may not preserve transparently. Keep those cases in the integration layer.

## Official sources

- https://docs.langchain.com/oss/python/integrations/chat/openai
- https://docs.langchain.com/oss/python/langchain/models
