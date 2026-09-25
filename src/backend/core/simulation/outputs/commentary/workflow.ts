/**
 * Purpose: Generate and checkpoint commentary through a bottom-up evidence frontier.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/simulation/outputs/commentary/node.ts
 */
import type { LLMSettings, ReportCommentary, ReportCommentaryNode, RunEvent, SimulationState } from "@/shared"
import { prepareReportEvidence } from "./evidence"
import { buildCommentaryNode, commentaryReadySchema, type CommentaryTask } from "./node"

/** Bottom-up frontier reduction. Only independent nodes run concurrently; successful siblings survive retries. */
export async function generateReportCommentary(
  state: SimulationState,
  settings: LLMSettings,
  emit: (event: RunEvent) => Promise<void>,
  isCanceled: () => boolean = () => false,
  save?: (value: ReportCommentary) => Promise<void>
): Promise<ReportCommentary> {
  const { context, packets } = prepareReportEvidence(state)
  const nodes: ReportCommentaryNode[] = []
  const prior = new Map(state.reportCommentary?.nodes.map((node) => [node.id, node]) ?? [])
  const changed = new Set<string>()
  let publishedCount = 0
  const checkCanceled = () => {
    if (isCanceled()) throw new Error("Run canceled.")
  }
  const publish = async (status: ReportCommentary["status"], rootId?: string) => {
    checkCanceled()
    const merged = new Map([...prior, ...nodes.map(node => [node.id, node] as const)])
    const completed = new Set(nodes.map(node => node.id))
    const dirty = new Set(changed)
    const invalidated: ReportCommentaryNode[] = []
    // Checkpoints must not retain a ready ancestor whose evidence was just regenerated.
    let propagated = true
    while (propagated) {
      propagated = false
      for (const node of merged.values()) {
        if (completed.has(node.id) || dirty.has(node.id) || !node.children.some(id => dirty.has(id))) continue
        dirty.add(node.id)
        const stale: ReportCommentaryNode = { ...node, status: "failed", issue: "Supporting analysis changed; synthesis must be retried." }
        merged.set(node.id, stale)
        invalidated.push(stale)
        propagated = true
      }
    }
    const value = {
      status,
      nodes: [...merged.values()],
      rootId: rootId ?? (status === "running" ? state.reportCommentary?.rootId : undefined)
    }
    await emit({
      type: "report.commentary",
      runId: state.runId,
      timestamp: new Date().toISOString(),
      update: { ...value, nodes: [...nodes.slice(publishedCount), ...invalidated] }
    })
    publishedCount = nodes.length
    await save?.(value)
    return value
  }
  // Persisted successes remain visible while only failed descendants are being retried.
  checkCanceled()
  await save?.({
    status: "running",
    nodes: state.reportCommentary?.nodes ?? [],
    rootId: state.reportCommentary?.rootId
  })
  let frontier: CommentaryTask[] = packets.map((packet) => ({ ...packet, children: [], level: 0 }))
  if (!frontier.length) return publish("failed")
  for (;;) {
    const results: ReportCommentaryNode[] = []
    // Two small independent requests protect local model servers from unbounded fan-out.
    for (let offset = 0; offset < frontier.length; offset += 2) {
      checkCanceled()
      const settled = await Promise.allSettled(
        frontier.slice(offset, offset + 2).map(async (task) => {
          const previous = prior.get(task.id)
          if (previous?.status === "ready" && !task.children.some((id) => changed.has(id))
            && commentaryReadySchema.safeParse(previous).success
            && previous.evidenceIds.every(id => task.evidenceIds.includes(id))) return previous
          changed.add(task.id)
          return buildCommentaryNode({ task, previous: task.children.some(id => changed.has(id)) ? undefined : previous,
            context, language: state.scenario.language, overall: frontier.length === 1 && task.level >= 2,
            settings, runId: state.runId, emit, isCanceled })
        })
      )
      const rejection = settled.find((item) => item.status === "rejected")
      if (rejection?.status === "rejected") throw rejection.reason
      const batch = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []))
      results.push(...batch)
      nodes.push(...batch)
      if (batch.some((node) => node.issue === "Provider unavailable after 3 attempts."))
        return publish("failed")
      await publish("running")
    }
    if (frontier.length === 1 && (frontier[0]?.level ?? 0) >= 2) {
      const root = results[0]
      return publish(
        root?.status !== "ready"
          ? "failed"
          : nodes.some((node) => node.status === "failed")
            ? "partial"
            : "ready",
        root?.id
      )
    }
    const next: CommentaryTask[] = []
    for (let offset = 0; offset < results.length; offset += 4) {
      const children = results.slice(offset, offset + 4)
      const level = (children[0]?.level ?? 0) + 1
      next.push({
        id: `branch-${level}-${offset / 4}`,
        level,
        children: children.map((child) => child.id),
        evidenceIds: children.filter((child) => child.status === "ready").map((child) => child.id),
        text: JSON.stringify(
          children.map((child) => ({
            id: child.id,
            status: child.status,
            summary: child.summary?.slice(0, 800),
            conclusion: child.conclusion?.slice(0, 800),
            evidenceIds: child.evidenceIds
          }))
        )
      })
    }
    frontier = next
  }
}
