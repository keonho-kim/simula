import type { ReportCommentary, ReportCommentaryNode } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export function ReportCommentaryPanel({ commentary, t }: { commentary?: ReportCommentary; t: UiTexts }) {
  if (!commentary) return <p className="py-4 text-sm text-muted-foreground">{t.reportCommentaryEmpty}</p>
  const root = commentary.nodes.find((node) => node.id === commentary.rootId)
  const leaves = commentary.nodes.filter((node) => node.level === 0)
  const branches = commentary.nodes.filter((node) => node.level > 0 && node.id !== root?.id)
  return (
    <section aria-label={t.reportCommentary} className="flex flex-col gap-6 border-b pb-6">
      {commentary.status !== "ready" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {commentary.status === "running" ? t.reportCommentaryRunning : t.reportCommentaryPartial}
        </p>
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-semibold">{t.reportOverallConclusion}</h2>
        {root ? (
          <CommentaryNode node={root} t={t} />
        ) : (
          <p className="text-sm text-muted-foreground">{commentary.status === "running" ? t.reportCommentaryWaiting : t.reportCommentaryUnavailable}</p>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">{t.reportDetailedItems}</h2>
        <div className="flex flex-col gap-4 border-l pl-4">
          {leaves.map((node) => (
            <section key={node.id}>
              <h3 className="mb-2 text-sm font-medium">
                {t.round} {node.id.replace("round-", "").replace("-part-", " · ")}
              </h3>
              <CommentaryNode node={node} t={t} />
            </section>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">{t.reportDetailedConclusions}</h2>
        <div className="flex flex-col gap-4">
          {branches.length
            ? branches.map((node) => <CommentaryNode key={node.id} node={node} t={t} />)
            : leaves
                .filter((node) => node.status === "ready")
                .map((node) => (
                  <section key={node.id}>
                    <h3 className="text-sm font-medium">
                      {t.round} {node.id.replace("round-", "").replace("-part-", " · ")}
                    </h3>
                    <MarkdownContent content={node.conclusion ?? ""} fallback="—" />
                  </section>
                ))}
        </div>
      </section>
    </section>
  )
}

function CommentaryNode({ node, t }: { node: ReportCommentaryNode; t: UiTexts }) {
  if (node.status === "failed")
    return <p className="text-sm text-muted-foreground">{t.reportCommentaryUnavailable}</p>
  return (
    <article className="flex flex-col gap-2 text-sm leading-6">
      <MarkdownContent content={node.summary ?? ""} fallback="—" />
      <ul className="list-disc pl-5">
        {node.findings?.map((finding, index) => (
          <li key={index}>
            <MarkdownContent compact content={finding} fallback="—" />
          </li>
        ))}
      </ul>
      {node.level > 0 ? <MarkdownContent content={node.conclusion ?? ""} fallback="—" /> : null}
      <p className="text-xs text-muted-foreground">
        {t.reportEvidence}: {node.evidenceIds.join(", ")}
      </p>
    </article>
  )
}
