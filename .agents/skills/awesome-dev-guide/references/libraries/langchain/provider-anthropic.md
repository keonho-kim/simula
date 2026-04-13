# LangChain Anthropic Integration

Use this file when the repository needs Claude-family chat models through LangChain.

## Standard implementation pattern

```python
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(
    model="claude-sonnet-4-5",
    temperature=0,
)
```

## Recommended do / don't

- Do use `ChatAnthropic` when Claude-specific model behavior or features matter.
- Do keep tool use and structured output explicit rather than assuming all Claude families expose identical capabilities.
- Do keep provider credentials and model selection in one integration boundary.
- Do not copy Anthropic-specific request tuning into unrelated domain code.

## Practical notes

- Anthropic support should follow the same integration pattern as other providers: instantiate in an integration layer, wrap in one logging and exception path, then inject downward.
- If a graph route depends on a Claude-only capability, document that coupling explicitly in the owning node or design note.

## Compatibility notes

- Tool use, streaming, and advanced behaviors can vary by Claude family. Keep capability assumptions model-specific.

## Official sources

- https://docs.langchain.com/oss/python/integrations/chat/anthropic
- https://docs.langchain.com/oss/python/langchain/models
