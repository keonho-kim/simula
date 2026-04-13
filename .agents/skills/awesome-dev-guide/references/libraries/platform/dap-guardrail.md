# DAP Guardrail Usage

Use this reference when the task touches:

- guardrail policy lookup
- guardrail factory selection
- guardrail utility behavior
- concrete guardrail runners

## Main imports

```python
from chatbot.integrations.platform.dap.text import apply_guardrail, get_guardrail_policies
from chatbot.integrations.platform.dap.text.guardrail.guardrail_factory import GuardrailFactory
from chatbot.integrations.platform.dap.text.guardrail.runners.regex_runner import RegexRunner
from chatbot.integrations.platform.dap.text.guardrail.runners.secuxper_runner import SecuXPerRunner
```

## `get_guardrail_policies(flow_id)`

Use this to fetch the current guardrail policy set for a flow.

```python
policies = get_guardrail_policies(flow_id=101)
```

Expected policy structure:

- `mandatory`
  - `input`
  - `output`
- `optional`
  - `input`
  - `output`

Each filter record commonly contains:

- `seqNo`
- `filterId`
- `filterMethodTypeCd`
- `filterInfo`
- `failResultPolicy`

## `apply_guardrail(flow_id, input_text, policy_id, mode)`

Use this to apply mandatory filters and then an optional policy when `policy_id` is provided.

```python
filtered_text, result_type = apply_guardrail(
    flow_id=101,
    input_text="010-1234-5678",
    policy_id=3,
    mode="input",
)
```

Return values:

- `filtered_text`
- `result_type`
  - `"pass"`
  - `"blocked"`
  - `"masked"`

Selection rules:

- mandatory filters run first
- optional filters run only when `policy_id` matches an optional policy
- filters are ordered by `seqNo`

## `GuardrailFactory`

Use `GuardrailFactory.get_guardrail_runner(...)` when code needs a concrete runner instance for a known guardrail type.

```python
runner = GuardrailFactory.get_guardrail_runner("REGEXP")
```

Supported types in current code:

- `REGEXP`
- `SECUXPER`

## `RegexRunner`

Use `RegexRunner` when a policy uses local regular-expression filtering.

```python
runner = RegexRunner()
text, result = runner.run_guardrail(
    input_text="contact me at 010-1234-5678",
    filter_info={
        "regExp": "([01]{2}[0|1|6|7|8|9])[- ]?(\\d{3,4})[- ]?(\\d{4})",
        "maskingRegExp": "(?<=.{9}).",
    },
    fail_policy="mask",
)
```

Current behavior:

- no match -> `("original text", "pass")`
- match with `fail_policy == "block"` -> `("", "blocked")`
- match with other fail policies -> masked text and `"masked"`

## `SecuXPerRunner`

Use `SecuXPerRunner` when a policy delegates filtering to the SecuXPer endpoint.

```python
runner = SecuXPerRunner()
text, result = runner.run_guardrail(
    input_text="010-1234-5678",
    filter_info={
        "endPoint": "https://example/v1/chat/filter/",
        "user_id": "12",
        "user_no": "tester",
        "user_dept": "security",
        "user_name": "GENAI",
    },
)
```

Current result mapping:

- `0` -> `"pass"`
- `1` -> `"blocked"`
- `2` -> `"masked"`

## Runner contract

`GuardrailRunner` is the abstract base class.

Use this signature when adding a new runner:

```python
def run_guardrail(
    input_text: str = "",
    filter_info: dict | None = None,
    fail_policy: str = "block",
) -> tuple[str, ResultType]:
    ...
```
