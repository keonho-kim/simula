# Response Latency Optimization

Standard principles for reducing TTFT, total latency, and tail latency in LangGraph-based graphs.

## 1. Metrics To Check First

- TTFT: time to first token or first meaningful event
- intermediate latency: time until an intermediate state becomes visible
- total latency: time until the final answer is completed
- tail latency: time for the slowest upper slice of requests

## 2. Core Optimization Principles

### Reduce Unnecessary LLM Calls

- Handle routing, dedup, collect, top-k, and retry feedback with function nodes.
- Use single calls for classifier and planner nodes that produce short outputs.

### Reduce Input Length

- Inject only the required context instead of the full history.
- Compress recent conversation into summaries.
- Build retrieval context only after the final candidates are fixed.

### Distribute Work That Can Be Parallelized

- Run independent tool calls in parallel batches.
- Use bounded-concurrency parallel execution for query embedding and retrieval.
- Parallelize SQL generation by alias.

### Cut Candidate Counts Early

- Limit the number of query expansions.
- Limit retrieve top-k, relevance candidates, and final top-k.
- Normalize alias selection results into a bounded set.

### Remove Duplicates

- query dedupe
- chunk dedupe
- file/page dedupe
- reference merge

### Move Static Values To Startup

- allowlist
- schema snapshot
- static metadata

### Localize Failures

- Exclude failed individual candidates.
- Recover tool failures at the step level.
- Create retry feedback for SQL failures at the alias level.

## 3. Focus Areas By Graph Type

| Type | Main reduction point |
| --- | --- |
| Plan-and-Execute | dependency-based parallel tool execution |
| RAG | candidate pruning and deduplication |
| Text-to-SQL | metadata short-circuit and static schema injection |

## 4. Anti-Patterns

- enabling token streaming even for classifier nodes
- setting retrieve top-k too high and delaying dedup
- recomputing schema that could have been prepared at startup for every request
- increasing parallelism without controlling connection pools, rate limits, or thread counts
- retrying the whole request even for work that can tolerate partial failure

## 5. Checklist

1. Does this step really require an LLM?
2. Is there a real reason to inject the entire history?
3. Is there an upper bound on the candidate count?
4. Is dedup placed early enough?
5. Is the unit of parallelization independent?
6. Can a failure avoid immediately breaking the entire request?
7. Does the intermediate event shown to the user have real value?
