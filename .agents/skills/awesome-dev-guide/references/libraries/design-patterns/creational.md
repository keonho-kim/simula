# Creational Patterns

Minimal creational patterns for keeping object construction and assembly simple.

## 1. Factory Function / Factory Method

### When To Use It

- When construction branches should be gathered in one place
- When the implementation must be selected by runtime configuration
- When heavyweight construction logic should be hidden from the call site

### Minimal Implementation Rules

- Prefer function-based factories before class-based factories.
- Gather construction branches in exactly one place.
- Make them responsible only for selection and construction.

### Example Uses

- creating an LLM client
- creating a DB client
- selecting a runtime backend
- initializing a tool registry

### Cases To Avoid

- creating a factory when there is only one implementation
- making factories create other factories

## 2. Constructor Injection

### When To Use It

- When dependencies must be made explicit
- When tests need to inject replacement implementations
- When controlling the assembly point matters more than global access

### Minimal Implementation Rules

- Prefer constructor arguments or explicit factory arguments.
- Inject only the dependencies that are needed.
- Do not route around them through a service locator.

### Example Uses

- injecting a logger, checkpointer, and registry into a graph executor
- injecting a repository and graph into a service

### Cases To Avoid

- pushing too many dependencies into a single object
- turning injection itself into new complexity

## 3. Lazy Initialization

### When To Use It

- When an expensive object is needed only during actual requests
- When you want to reduce cold-start cost

### Minimal Implementation Rules

- Apply it only to expensive objects.
- Keep the failure point predictable.
- Prevent the lazy object from spreading like hidden global state.

### Example Uses

- initializing an LLM client
- preparing an external-connection client

### Cases To Avoid

- making almost every object lazy
- making failure timing harder to reason about

## 4. Limited Builder

### When To Use It

- When the combination of construction parameters is actually complex
- When ordered configuration improves readability

### Minimal Implementation Rules

- Do not create a builder when a simple dict is enough.
- Use it only when the output is one clear object.
- Keep fluent APIs short and constrained.

### Example Uses

- query builder
- filter builder
- graph config builder

### Cases To Avoid

- objects with only two or three parameters
- builders that are more complex than the object they produce
