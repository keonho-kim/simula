# DAP Text Usage

Use this reference when the task touches:

- text prompt retrieval
- token counting
- collector logging
- credential JSON export helpers

## Package-level imports

```python
from chatbot.integrations.platform.dap.text import (
    TextClient,
    text,
    LogInput,
    serialize_credentials_to_json,
)
```

Use direct-file imports when you need the implementation class explicitly:

```python
from chatbot.integrations.platform.dap.text.text_client import TextClient
from chatbot.integrations.platform.dap.text.log_input.log_input import LogInput
```

## `TextClient`

Use `TextClient` for:

- prompt lookup
- token counting
- collector logging
- credential JSON export helpers

If the caller is doing inference-side token accounting or credential/export orchestration around DAP service IDs, open `dap-key-manager.md` as well.

### `get_prompts()`

Fetch prompt definitions for the current project.

```python
from chatbot.integrations.platform.dap.text import TextClient

client = TextClient()
prompts = client.get_prompts()
first_prompt = prompts[0]
```

Returned prompt items have this normalized shape:

- `name`
- `variables`
- `examples`
- `meta_prompt`
- `user_prompt`

### `count_token(model_name, text)`

Count tokens with `tiktoken`.

```python
count = TextClient.count_token("gpt-4o-mini", "hello world")
```

Use this for logging payloads and usage calculations.

### `collect(...)`

Send summarized input/output usage data to the DAP collector.

```python
response = client.collect(
    input_output_texts=[
        {"input_text": "hello", "output_text": "world"},
    ],
    model_name="gpt-4o-mini",
    credential={"serviceId": "1", "credentialId": "2"},
    process_start_time="2025-01-01 10:00:00",
    process_end_time="2025-01-01 10:00:01",
    queue_time=10,
)
```

Required payload pieces:

- `input_output_texts`
  - list of dicts with `input_text` and `output_text`
- `model_name`
- `credential`
  - must contain `serviceId` and `credentialId`

### `log(input_obj)`

Send detailed collector data using a `LogInput` instance.

```python
from chatbot.integrations.platform.dap.text import LogInput, text

payload = LogInput(
    start_time="2025-01-02 13:46:32.562",
    finish_time="2025-01-02 13:46:33.268",
    input_message="hello",
    output_message="world",
)
text.log(payload)
```

Use this when the caller already has a structured collector payload instead of per-message usage summaries.

## `LogInput`

`LogInput` is the structured payload object for `TextClient.log`.

Minimum fields:

- `start_time`
- `finish_time`

Common optional fields:

- `project_id`
- `service_id`
- `input_tokens`
- `output_tokens`
- `token_usage`
- `elapsed_time`
- `input_message`
- `output_message`
- `flow_his_in_out`
- `gpt_response_content`
- `gpt_start_time`
- `gpt_finish_time`
- `gpt_elapsed_time`
- `custom01` through `custom10`

Construction patterns:

```python
payload = LogInput(
    start_time="2025-01-02 13:46:32.562",
    finish_time="2025-01-02 13:46:33.268",
)

payload_dict = payload.to_dict()
payload_again = LogInput.from_dict(payload_dict)
```

## `serialize_credentials_to_json(...)`

Use this helper to write a simplified credential list to `000_credentials.json`.

```python
from chatbot.integrations.platform.dap.text import serialize_credentials_to_json

serialize_credentials_to_json(
    [
        {"serviceId": "1", "credentialId": "10"},
        {"serviceId": "2", "credentialId": "20"},
    ]
)
```

This helper keeps only `serviceId` and `credentialId`.
