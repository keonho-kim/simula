# DAP Common Usage

Use this reference when the task touches:

- shared DAP config loading
- the DAP client
- cache-backed list helpers
- fallback list behavior

## Main entrypoints

```python
from chatbot.integrations.platform.dap.common import DapClient, dap, config
from chatbot.integrations.platform.dap.common.file_cached_list import _FileCachedList
from chatbot.integrations.platform.dap.common.fallback_list import _FallbackList
```

## `config` module

Use `config` for environment-derived values and DAP file locations.

Common values:

- `config.MLDL_BASE_URL`
- `config.USER_ID`
- `config.PARAMS_JSON_LOCATION`
- `config.IS_INFERENCE`
- `config.PROJECT_ID`
- `config.COLLECTOR_URL`
- `config.INFER_ENV_ID`
- `config.DEV_ID`
- `config.PATH_MODELS`
- `config.EXTERNAL_RESOURCE_FILE_PATH`
- `config.PROMPT_CACHE_FILE_PATH`
- `config.INFER_SVC_ID`

Helper functions:

- `config.read_params_json(path=...)`
  - read parameter JSON from the inference file location
- `config.get_first_matching_file(base_path, pattern)`
  - resolve a cache file path by scanning a directory tree
- `config.get_dev_cache_file(file_name)`
  - build the development cache path under `PATH_MLDL_HOME/work/flow`

Example:

```python
from chatbot.integrations.platform.dap.common import config

params = config.read_params_json()
if config.IS_INFERENCE:
    cache_path = config.EXTERNAL_RESOURCE_FILE_PATH
```

## `DapClient`

Use `DapClient` for external-resource lookup and credential lookup.

```python
from chatbot.integrations.platform.dap.common import DapClient

client = DapClient()
resources = client.get_external_resources(
    provider_alias="OpenAI",
    solution_id="GENTEXT",
    service_type_name="LLM",
)
credentials = client.get_credentials(service_id=1)
```

### `get_external_resources(...)`

Parameters:

- `provider_alias`
- `solution_id`
- one of `service_type_name` or `service_type`

Return shape:

- `_FileCachedList`
- list items are external-resource records returned by the DAP endpoint

### `get_credentials(...)`

Parameters:

- `service_id`
- optional `user_id`

Return shape:

- list of credential dictionaries
- each item includes `serviceId`, `credentialId`, and `variables`

Use this when another adapter needs a credential record before calling an external model or service.

`dap/key_manager` builds on these two flows. If the task is about turning raw DAP records into KL, Redis, RDB, or inference-ready values, open `dap-key-manager.md` as well.

## `_FileCachedList`

Use `_FileCachedList` when the adapter should behave like a list while persisting the selected item as JSON.

```python
from pathlib import Path
from chatbot.integrations.platform.dap.common.file_cached_list import _FileCachedList

items = _FileCachedList(
    [{"id": "1"}, {"id": "2"}],
    file_path=Path("work/flow/example.json"),
    use_cache=False,
)
first = items[0]
```

Behavior:

- behaves like a `list`
- when indexed, returns the selected item
- when the requested index is missing, falls back to index `0`

## `_FallbackList`

Use `_FallbackList` when the adapter should return the first element on out-of-range access.

```python
from chatbot.integrations.platform.dap.common.fallback_list import _FallbackList

items = _FallbackList([{"credentialId": "1"}])
fallback = items[99]
```

This helper is used by inference credential paths.
