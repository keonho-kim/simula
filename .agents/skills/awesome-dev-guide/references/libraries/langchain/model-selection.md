# LangChain Model Selection

Use this file when deciding how to instantiate chat models and how much provider abstraction the change really needs.

## Standard implementation pattern

- Use a provider-specific class such as `ChatOpenAI`, `ChatAnthropic`, or `ChatGoogleGenerativeAI` when one provider is actually intended and provider-specific controls matter.
- Use `init_chat_model(...)` only when runtime provider switching is a real requirement.
- Keep provider instances behind one application-owned wrapper or factory so the rest of the app does not depend on provider-specific setup details.
- If the concrete backend is vLLM, still prefer `ChatOpenAI` because the LangChain integration path is OpenAI-compatible transport. Put vLLM-specific request tuning in the integration layer, not in graph nodes.

## Recommended do / don't

- Do optimize for the smallest abstraction that satisfies the requirement.
- Do use direct provider classes when one provider is already chosen.
- Do keep provider-specific credentials, base URLs, and model IDs out of unrelated business logic.
- Do not introduce dynamic provider selection just because it is possible.
- Do not let agent middleware or model selection logic leak into graph nodes unless the feature explicitly requires it.

## Practical notes

- Keep model wrapping in one integration boundary instead of letting nodes depend on raw provider classes directly.
- If a new provider is added, wire it through the integration layer first, then let higher-level workflows depend on the wrapper instead of the raw provider class.
- For self-hosted OpenAI-compatible backends, first ask whether the transport is just “OpenAI-compatible” or concretely vLLM. If it is vLLM, pair this file with `provider-vllm.md` before deciding how much provider-specific configuration is acceptable.

## Official sources

- https://docs.langchain.com/oss/python/langchain/models
- https://docs.langchain.com/oss/python/langchain/overview
