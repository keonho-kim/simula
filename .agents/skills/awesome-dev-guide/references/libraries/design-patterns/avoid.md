# Patterns To Avoid

Patterns and structures that often lead to overengineering in minimal agent implementations.

## 1. Excluded Pattern Table

| Pattern | Why To Avoid It |
| --- | --- |
| Strategy pattern | Decomposing even small branches into interfaces and implementation classes often becomes more complex than one or two functions. |
| Abstract factory | When the implementation family is small and stable, it only adds unnecessary construction layers. |
| Service locator | It hides dependencies and makes testing and tracing worse. |
| Visitor | The cost of type hierarchies and double dispatch is too high for minimal systems. |
| Excessive inheritance-based hook systems | As subclasses and hooks grow for each small variation, maintainability degrades rapidly. |
| Early plugin framework | Before actual extension demand is verified, it makes the initial structure heavy. |
| Excessive decorator chains | As wrappers grow, flow and responsibilities become harder to see. |
| Early event bus | Call flow becomes hidden, making debugging and failure tracing harder. |
| Generic base class | In trying to build a shared base, it often forces together different lifecycles and responsibilities. |

## 2. Common Warning Signals

- The pattern explanation is longer than the implementation explanation.
- The pattern exists only for testing.
- There are more interfaces than real implementations.
- The number of classes grows to handle a small branch.
- It becomes hard to follow the call flow directly through IDE navigation.
- Current complexity is accepted only because of assumed future extensibility.

## 3. Alternative Principles

- Keep simple branches as functions and conditionals.
- Introduce a factory only when construction complexity is a real problem.
- Use adapters, facades, and gateways only at external system boundaries.
- Prefer thin shared executors and explicit state contracts.
- Do not create plugin structures or generic hook systems until the need is verified.

## 4. Final Checklist

1. Does the pattern reduce complexity, or merely move it?
2. Is it needed now, or only for a future assumption?
3. Can this be solved with functions and small object composition?
4. Does it make debugging and tracing easier?
5. Does it make call flow more explicit?
