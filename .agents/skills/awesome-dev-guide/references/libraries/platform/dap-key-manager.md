# DAP Key Manager Usage

Use this reference when the task touches:

- key-manager helper exports
- inference credential export
- token collector and token usage helpers
- KL, RDB, or Redis credential shaping helpers

## Purpose

`dap/key_manager` is the adapter slice that turns DAP credential and external-resource records into service-specific runtime values.

Use it for:

- inference-vs-development cache path selection
- external-resource cache loading
- credential attribute lookup
- service-specific connection info shaping for KL, RDB, and Redis
- inference credential export for downstream consumers
- inference token collector and token-usage helpers

## Main building blocks

### `__init__.py`

Shared helper module for:

- `IS_INFERENCE`
- `PATH_MLDL_HOME`
- `PATH_MODELS`
- `EXTERNAL_RESOURCE_FILE_PATH`
- `get_external_cached_resources(...)`
- `get_resource(...)`
- `get_attribute_value(...)`

Use this layer when a caller needs a DAP external resource plus credential attributes but the result must already be shaped for a specific runtime concern.

### `InferenceCreds`

`InferenceCreds.make(service_ids)`:

- looks up DAP credentials for each `service_id`
- resolves matching external resources
- writes simplified credentials through `serialize_credentials_to_json(...)`
- writes selected external resources to `EXTERNAL_RESOURCE_FILE_PATH`

Use this when an inference environment needs local cache files prepared before model or flow execution.

### Service-specific helpers

- `CallKLService.get_collection_info(service_id)`
  - returns `endpoint`, `collection_alias`, `access_key`
- `CallRDBService.get_info(service_id)`
  - returns `endpoint`, `user_id`, `password`
- `CallRedisService.get_info(service_id)`
  - returns `endpoint`

Use these helpers when the caller already knows the DAP `service_id` and needs concrete connection values for a downstream client.

### Token helpers

- `DAPTokenCounter.collect(...)`
  - delegates token collection to `dap.text.collect(...)`
- `DAPTokenCounter.collect_image(...)`
  - reports image-sized output usage through the same collector path
- `DAPTokenUsage.get_token_usage(...)`
  - caches the last response for a short duration before calling the inference collector again

Use these helpers for inference-side accounting. Keep request payload details in `dap/text` and keep inference-side orchestration in `dap/key_manager`.

## Preferred imports

Use package imports from the current repository namespace:

```python
from chatbot.integrations.platform.dap.key_manager import (
    EXTERNAL_RESOURCE_FILE_PATH,
    get_attribute_value,
    get_resource,
)
from chatbot.integrations.platform.dap.key_manager.infer_creds import InferenceCreds
from chatbot.integrations.platform.dap.key_manager.kl_module import CallKLService
from chatbot.integrations.platform.dap.key_manager.rdb_module import CallRDBService
from chatbot.integrations.platform.dap.key_manager.redis_module import CallRedisService
from chatbot.integrations.platform.dap.key_manager.token_collector import DAPTokenCounter
from chatbot.integrations.platform.dap.key_manager.token_usage import DAPTokenUsage
```

## Relationship to other platform references

- open `dap-common.md` when the change affects raw DAP config loading, `DapClient`, or cache-file discovery
- open `dap-text.md` when the change affects prompt retrieval, collector payload shapes, or credential JSON serialization
- open `dap-kl.md` when the change affects Knowledge Lake client requests after credentials are already resolved

## Working rules

- Keep DAP credential records and external-resource records inside `integrations/platform`.
- Reuse `get_resource(...)` and `get_attribute_value(...)` before adding another credential lookup path.
- Keep service-specific output shaping in the smallest helper that matches the downstream consumer.
- Do not move token collector payload logic into `core` or `shared`; keep DAP-specific usage reporting here or in `dap/text`.
- Prefer documenting current cache-path and inference behavior instead of introducing a new abstraction layer.
