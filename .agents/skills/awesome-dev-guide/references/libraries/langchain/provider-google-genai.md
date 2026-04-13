# LangChain Google GenAI Integration

Use this file when the repository needs Gemini-family chat models through `langchain-google-genai`.

## Standard implementation pattern

```python
from langchain_google_genai import ChatGoogleGenerativeAI

model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0,
)
```

## Recommended do / don't

- Do use `ChatGoogleGenerativeAI` when the repository is intentionally on the Google GenAI integration path.
- Do keep model ID, API key handling, and transport options inside one integration boundary.
- Do validate structured output or tool-calling assumptions per selected Gemini model.
- Do not mix provider-specific prompt assumptions into generic graph state or HTTP DTOs.

## Practical notes

- Prefer extending one consistent integration pattern over introducing a parallel wrapper style for Gemini usage.
- Preserve logging, retry, and stream handling boundaries when changing Gemini usage.

## Compatibility notes

- Model capability can differ across Gemini variants. Keep the capability contract tied to the selected model, not to the package name alone.

## Official sources

- https://docs.langchain.com/oss/python/integrations/chat/google_generative_ai
- https://docs.langchain.com/oss/python/langchain/models
