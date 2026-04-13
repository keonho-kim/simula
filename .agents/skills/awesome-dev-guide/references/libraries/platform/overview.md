# Platform Adapter Overview

Use this reference when a task touches DAP or Knowledge Lake adapter behavior.

## Topic map

- `dap/common`
  - shared DAP config values
  - DAP client entrypoints for credentials and external resources
  - cached list helpers
- `dap/key_manager`
  - inference and development cache-path resolution
  - service-specific credential shaping for KL, Redis, and RDB
  - inference credential export and token usage helpers
- `dap/text`
  - prompt retrieval
  - collector logging
  - credential serialization
  - guardrail helpers and runners
- `dap/kl`
  - Knowledge Lake (KL) search and chunk lookup

## Which reference should you open?

- `dap-common.md`
  - use when the task touches config values, `DapClient`, credentials, or external-resource lookup
- `dap-key-manager.md`
  - use when the task touches key-manager helpers, inference credential export, service-specific connection shaping, or inference token usage lookup
- `dap-text.md`
  - use when the task touches prompt retrieval, token counting, collector logging, `LogInput`, or credential JSON export
- `dap-guardrail.md`
  - use when the task touches guardrail policy lookup, `apply_guardrail`, runner selection, regex rules, or SecuXPer integration
- `dap-kl.md`
  - use when the task touches Knowledge Lake (KL), `KlClient`, chunk retrieval, or vector search requests

## Preferred import paths

Use package imports from the current repository namespace:

```python
from chatbot.integrations.platform.dap.common import DapClient, dap, config
from chatbot.integrations.platform.dap.key_manager import get_attribute_value, get_resource
from chatbot.integrations.platform.dap.text import (
    TextClient,
    text,
    LogInput,
    apply_guardrail,
    get_guardrail_policies,
    serialize_credentials_to_json,
)
from chatbot.integrations.platform.dap.kl import KlClient, kl
```

Use submodule imports only when you need a specific implementation file:

```python
from chatbot.integrations.platform.dap.text.text_client import TextClient
from chatbot.integrations.platform.dap.text.log_input.log_input import LogInput
from chatbot.integrations.platform.dap.text.guardrail.runners.regex_runner import RegexRunner
```

## Working rules

- Keep platform-specific HTTP payload shapes inside `integrations/platform`.
- Reuse existing entrypoints before adding a new package-level export.
- Prefer documenting current behavior over redesigning the adapter boundary.
- Keep DAP examples aligned with the current repository import path, not the legacy `dap_gen.*` path.
