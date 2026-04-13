# DAP Knowledge Lake (KL) Usage

Use this reference when a task mentions `Knowledge Lake`, `KL`, or the DAP KL client.

Use this reference when the task touches:

- KL client behavior
- chunk lookup
- vector or hybrid search requests

## Main imports

```python
from chatbot.integrations.platform.dap.kl import KlClient, kl
from chatbot.integrations.platform.dap.kl.kl_client import KlClient
```

Use:

- `kl`
  - package-level convenience client
- `KlClient`
  - explicit class when the caller wants to instantiate the client directly

## `get_chunk_list(...)`

Use this method to fetch chunk records for a document or a filter set.

```python
client = KlClient()
chunks = client.get_chunk_list(
    kl_endpoint="https://example-host/api/v1/search/vectordb",
    access_key="ACCESS_KEY",
    collection_alias="collection-a",
    doc_id="doc-123",
)
```

Minimum requirement:

- provide either `doc_id`
- or a non-empty `filter`

Common filter shape:

```python
[
    {"key": "FIELD", "value": ["VALUE"]},
]
```

Common parameters:

- `kl_endpoint`
- `access_key`
- `collection_alias`
- optional `app_nm`
- optional `user_id`
- optional `doc_id`
- optional `filter`

## `search(...)`

Use this method for Knowledge Lake (KL) retrieval and hybrid search.

```python
results = client.search(
    kl_endpoint="https://example-host/api/v1/search/vectordb",
    access_key="ACCESS_KEY",
    collection_alias="collection-a",
    question="What is the policy?",
    topK=5,
    hybrid_yn=True,
    alpha=0.5,
)
```

Common optional parameters:

- `filter`
- `min_score`
- `lang_question`
- `meta_weight`
- `keylook_args`
- `question_vector`

Use `lang_question` for multilingual variants:

```python
lang_question = [
    {"lang_cd": "en", "question": "What is the policy?"},
    {"lang_cd": "ko", "question": "정책이 무엇인가요?"},
]
```

## LangChain document conversion

Set `is_langchain_type=True` when the caller wants `langchain_core.documents.Document` results.

```python
docs = client.search(
    kl_endpoint="https://example-host/api/v1/search/vectordb",
    access_key="ACCESS_KEY",
    collection_alias="collection-a",
    question="What is the policy?",
    is_langchain_type=True,
)
```

Converted document behavior:

- source field `content` becomes `page_content`
- all other source keys move into `metadata`

## Response handling conventions

Current Knowledge Lake (KL) methods expect the remote API to return:

- HTTP `200`
- JSON with `resultCode == "200"`
- payload under `result`

Use that contract when wiring new call sites or when adjusting request/response handling.
