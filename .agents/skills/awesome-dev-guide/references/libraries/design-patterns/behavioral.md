# Behavioral Patterns

Minimal behavioral patterns for keeping execution flow and algorithm structure explicit.

## 1. Template Method

### When To Use It

- When the algorithm skeleton is fixed and only some steps vary
- When lifecycle order must be strongly fixed

### Minimal Implementation Rules

- Use it only when the order is truly fixed.
- Keep the number of hooks minimal.
- Do not use it if composition is simpler than inheritance.

### Example Uses

- worker loop
- session lifecycle
- shared executor for graph nodes

### Cases To Avoid

- increasing subclasses for every small difference
- using it while the algorithm still changes frequently

## 2. Command

### When To Use It

- When execution units must be represented as explicit objects or payloads
- When handling work that needs retries, queue insertion, or batch execution

### Minimal Implementation Rules

- Keep commands as thin execution units.
- Separate the executor from the command data.
- Add history, undo, or macro behavior only when there is a real need.

### Example Uses

- tool call payload
- queued job
- batch execution item

### Cases To Avoid

- turning ordinary function calls into command objects
- letting the command layer grow larger than the domain model

## 3. Pipeline / Chain

### When To Use It

- When processing flows through several ordered stages
- When you want to separate validation, normalization, and post-processing by stage

### Minimal Implementation Rules

- Make each stage's input and output explicit.
- Keep it as simple function calls when the number of stages is small.
- Do not create pass-through stages with unclear responsibilities.

### Example Uses

- planner -> validate -> execute
- retrieve -> dedup -> relevance -> format
- generate SQL -> execute -> collect

### Cases To Avoid

- having many stages while each stage's responsibility stays unclear
- using it when one function would be enough

## 4. Rule-Based Router

### When To Use It

- When branches should be handled through normalized tokens
- When separating LLM output from execution branching

### Minimal Implementation Rules

- Separate raw results from route tokens.
- Keep the route short and deterministic.
- Do not let the router perform the actual work.

### Example Uses

- safeguard route
- context strategy route
- execute decision route

### Cases To Avoid

- mixing domain policy and execution logic inside the router
- using unstable branch tokens that keep changing the contract

## 5. State Object

### When To Use It

- When a shared-state contract between stages must be fixed
- When there are many intermediate states such as fan-out, collect, retry, or review

### Minimal Implementation Rules

- Split state keys by role.
- Standardize the final output key.
- Add reducers only to keys that require accumulated merging.

### Example Uses

- graph state
- step failure map
- review decision state

### Cases To Avoid

- extending the state object like a universal dict
- putting values with different lifecycles into one state object

## 6. Representative Patterns Excluded From This Category

- Strategy pattern: decomposing even small branches into interfaces and implementation classes often becomes more complex than functions.
- overusing observer-style events: an early event bus often reduces flow visibility.
- overgeneralized state machines: when the number of branches is small, route tokens are usually simpler.
