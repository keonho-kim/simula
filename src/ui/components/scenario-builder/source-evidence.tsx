/**
 * Purpose: Let readers inspect cited source content and locations on demand.
 * Pattern: Selected-detail presentation.
 * Usage: Mounted in the completed ScenarioBuilder review, without a nested dialog.
 * Related: src/ui/api-client/scenario-builder.ts, src/ui/models/documents/location.ts
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { DocumentSet, EvidenceBlock } from "@/shared/documents"
import type { UiTexts } from "@/ui/types/i18n"
import { fetchEvidenceBlock } from "@/ui/api-client/scenario-builder"
import { documentSourceLocation } from "@/ui/models/documents/location"
import { scenarioSourceName } from "@/ui/models/scenario-builder/source-name"
import { Button } from "@/ui/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card"

export function SourceEvidence({ setId, revision, ids, documents, t }: {
  setId: string; revision: number; ids: string[]; documents?: DocumentSet; t: UiTexts
}) {
  const [selectedId, setSelectedId] = useState<string>()
  const selectedDocument = documents?.documents.find(document => selectedId?.startsWith(`${document.id}:`))
  const evidence = useQuery({ queryKey: ["scenario-source-evidence", setId, revision, selectedId],
    enabled: !!selectedId && !!selectedDocument, retry: false, staleTime: Infinity,
    queryFn: ({ signal }) => {
      if (!selectedId || !selectedDocument) throw new Error("Select an available source before reading its evidence.")
      return fetchEvidenceBlock(setId, selectedDocument.id, selectedId, revision, signal)
    } })
  return <section className="flex min-w-0 flex-col gap-3" aria-label={t.builderSourceRefs}>
    <h3 className="text-sm font-medium">{t.builderSourceRefs}</h3>
    {ids.length ? <div className="document-builder-source-grid">
      <ul className="document-builder-source-list" aria-label={t.builderSourceRefs}>
        {ids.map((id, index) => {
          const document = documents?.documents.find(value => id.startsWith(`${value.id}:`))
          const label = t.builderEvidenceItem.replace("{index}", String(index + 1))
          return <li key={id}><Button type="button" variant={selectedId === id ? "secondary" : "ghost"} size="sm"
            className="w-full min-w-0 justify-start" aria-pressed={selectedId === id} onClick={() => setSelectedId(id)}>
            <span className="truncate">{document ? scenarioSourceName(document.name, t) : t.builderEvidenceUnavailable} · {label}</span>
          </Button></li>
        })}
      </ul>
      <Card size="sm" className="min-w-0">
        <CardHeader><CardTitle><h4>{selectedDocument ? scenarioSourceName(selectedDocument.name, t) : t.builderSourceDetail}</h4></CardTitle></CardHeader>
        <CardContent className="document-builder-source-detail">
          {!selectedId ? <p className="text-muted-foreground">{t.builderSelectEvidence}</p>
            : !selectedDocument ? <p role="alert">{t.builderEvidenceUnavailable}</p>
              : evidence.isPending ? <p role="status">{t.builderLoadingEvidence}</p>
                : evidence.isError ? <div className="flex flex-col items-start gap-2"><p role="alert">{t.builderEvidenceUnavailable}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void evidence.refetch()}>{t.builderRetry}</Button></div>
                  : evidence.data ? <EvidenceContent block={evidence.data} t={t} /> : null}
        </CardContent>
      </Card>
    </div> : <p className="text-sm text-muted-foreground">{t.builderNoEvidence}</p>}
  </section>
}

function EvidenceContent({ block, t }: { block: EvidenceBlock; t: UiTexts }) {
  const method = block.method === "vlm" ? t.builderEvidenceVisual
    : block.method === "pdfjs" ? t.builderEvidencePdfText
      : block.method === "libreoffice" ? t.builderEvidenceConverted : t.builderEvidenceExtracted
  return <div className="flex min-w-0 flex-col gap-3">
    <p className="text-xs text-muted-foreground">{method} · {documentSourceLocation(block.locator, t)}</p>
    <p className="whitespace-pre-wrap break-words text-sm leading-6">{block.content}</p>
  </div>
}
