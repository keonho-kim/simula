# LangGraph Graph Core

The LangGraph primitives used most often when assembling graph structure.

## 1. `StateGraph`

### When To Use It

- When assembling a state-based workflow
- When grouping nodes, edges, branches, and reducers into one execution unit

### Minimal Usage Rules

- Keep the state schema to only the required keys.
- Return only the updates each node actually needs.
- Finish graph assembly in one place and do not change structure during execution.

## 2. `START` / `END`

### When To Use Them

- When explicitly defining the start point and end point

### Minimal Usage Rules

- Keep a single entry point.
- Converge end paths to `END` whenever possible.
- Place a thin prepare or safeguard node immediately after the start.

## 3. `add_node`

### When To Use It

- When registering a function, object, or executor as a graph step

### Minimal Usage Rules

- Name nodes so their roles are obvious.
- Give each node only one responsibility.
- Keep deterministic logic in function nodes, and use LLM nodes only for uncertain judgment.

## 4. `add_edge`

### When To Use It

- When connecting a fixed sequential flow

### Minimal Usage Rules

- Prefer `add_edge` for sequential flows.
- Do not turn a step into a conditional edge when there is no branching logic.

## 5. `add_conditional_edges`

### When To Use It

- When deciding the next node from state values
- When returning a `Send` list as a fan-out target

### Minimal Usage Rules

- Separate raw results from route tokens.
- Keep branch functions short and deterministic.
- Do not perform heavy computation or external calls inside branch functions.

## 6. `MessagesState`

### When To Use It

- When a conversational message array is the center of state

### Minimal Usage Rules

- It is useful for simple conversational graphs.
- Once structured state grows, prefer a dedicated state schema.
- Do not try to express all execution state through a single message array.

## 7. Checklist

1. Does the state schema contain only the keys that are needed?
2. Do node names reveal their roles immediately?
3. Did you clearly separate sequential flow from branching flow?
4. Did you avoid overgeneralizing `MessagesState`?
