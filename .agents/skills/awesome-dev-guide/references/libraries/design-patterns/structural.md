# Structural Patterns

Minimal structural patterns for keeping external boundaries and internal contracts simple.

## 1. Facade

### When To Use It

- When you want to wrap an external SDK or runtime assembly behind one entry point
- When you want to expose a multi-step initialization procedure through a simple interface

### Minimal Implementation Rules

- Make it responsible only for boundary simplification.
- Do not put domain rules or branch policy inside the facade.
- Do not stack one facade behind another.

### Example Uses

- graph execution entry point
- runtime bootstrap assembly

### Cases To Avoid

- adding an object only to hide a few simple functions
- letting the facade take over the service layer role

## 2. Adapter

### When To Use It

- When external types must be converted into an internal contract
- When input and output shapes differ from team standards

### Minimal Implementation Rules

- Make it responsible only for format conversion.
- Keep policy and validation outside the adapter.
- Do not let one adapter wrap multiple external systems at once.

### Example Uses

- converting an external LLM response into the internal message structure
- converting a DB document into a state-friendly dict

### Cases To Avoid

- creating a separate class only for simple key renaming
- mixing retry, caching, or business rules into the adapter

## 3. Gateway

### When To Use It

- When external system calls must be separated from domain logic
- When you want to hide network, DB, or model access behind one boundary

### Minimal Implementation Rules

- Wrap only the external access boundary.
- Let upper-level services decide calling policy.
- Do not put all external systems behind one monolithic gateway.

### Example Uses

- LLM gateway
- vector search gateway
- SQL execution gateway

### Cases To Avoid

- wrapping purely internal utilities as gateways
- mixing state transitions and business flow into the gateway

## 4. Thin Proxy / Decorator

### When To Use It

- When you need a thin cross-cutting behavior such as logging, measurement, guarding, or caching
- When you want to add behavior while preserving the original interface

### Minimal Implementation Rules

- Give each wrapper only one cross-cutting responsibility.
- Keep wrapper chains short.
- Do not put core business rules inside wrappers.

### Example Uses

- LLM call logging
- DB call latency measurement
- safe-execution guard wrapper

### Cases To Avoid

- nesting so many decorators that the flow becomes unreadable
- giving every wrapper its own state so debugging becomes hard

## 5. DTO

### When To Use It

- When the transfer contract between layers must be fixed
- When API, event, DB row, or stream payload must be expressed explicitly

### Minimal Implementation Rules

- Use it only at boundaries.
- Keep it as a thin data structure without behavior.
- Do not let DTOs evolve into domain models.

### Example Uses

- stream event payload
- tool result envelope
- review payload

### Cases To Avoid

- creating DTOs for every simple value passed between internal functions
- duplicating DTOs and entities through repeated copying

## 6. Also Avoid Within This Category

- introducing Composite too early and complicating small object graphs
- mixing Proxy and Decorator excessively without distinction
- using DTOs as universal data models
