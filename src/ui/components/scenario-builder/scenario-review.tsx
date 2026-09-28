/**
 * Purpose: Present a generated scenario's assumptions, participants, rules, and issues.
 * Pattern: Read-only review composition.
 * Usage: Displayed after shared scenario generation reaches a terminal draft.
 * Related: src/shared/scenario-builder.ts, src/ui/components/scenario-builder/scenario-builder-dialog.tsx
 */
import type { ScenarioSpecification } from "@/shared/scenario-builder"
import type { DocumentSet } from "@/shared/documents"
import type { UiTexts } from "@/ui/types/i18n"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card"
import { Badge } from "@/ui/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/ui/components/ui/alert"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { SourceEvidence } from "./source-evidence"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export function ScenarioReview({ specification: value, documents, t }: { specification: ScenarioSpecification; documents?: DocumentSet; t: UiTexts }) {
  return <section className="flex flex-col gap-5" aria-label={t.builderReviewTitle}>
    <header className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold"><MarkdownContent generated inline content={value.situation.title} /></h2>
      <MarkdownContent generated content={value.situation.purpose} />
      <MarkdownContent generated content={value.situation.setting} />
    </header>
    {value.issues.length ? <Alert variant={value.status === "blocked" ? "destructive" : "default"}>
      <AlertTitle>{t.builderIssues}</AlertTitle><AlertDescription><ul className="flex list-disc flex-col gap-2 pl-4">
        {value.issues.map((issue, index) => <li key={index}>{documents?.documents.some(document => document.id === issue.scope) ? t.builderPartialHelp : issue.description}</li>)}
      </ul></AlertDescription>
    </Alert> : null}
    <div className="document-builder-review-grid">
      <ReviewCard title={t.builderDecision} paragraphs={[value.situation.decision]} />
      {Object.entries(value.facets).map(([key, facet]) => <ReviewCard key={key} title={builderLabel(key, t)} paragraphs={[facet.summary]} assumptions={facet.assumptions} t={t} />)}
      {value.participants.map(participant => <Card key={participant.id} size="sm">
        <CardHeader><CardTitle><h3><MarkdownContent generated={!participant.nameLocked} inline content={participant.name} /></h3></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {participant.nameLocked ? <Badge variant="outline">{t.builderLocked}</Badge> : null}
          {[{ label: t.builderPersonality, text: participant.personality }, { label: t.builderAuthority, text: participant.authority }, { label: t.builderGoal, text: participant.goal }].map(field => <div key={field.label}>
            <p className="text-xs text-muted-foreground">{field.label}</p><MarkdownContent generated className="mt-1" content={field.text} />
          </div>)}
        </CardContent>
      </Card>)}
      {Object.entries(value.rules).map(([key, rule]) => <ReviewCard key={key} title={builderLabel(key, t)} paragraphs={rule.entries} assumptions={rule.assumptions} t={t} />)}
      <Card size="sm">
        <CardHeader><CardTitle><h3>{t.builderSourceAccess}</h3></CardTitle></CardHeader>
        <CardContent>
          {value.sourceFacts.length ? <ul className="flex flex-col gap-3">
            {value.sourceFacts.map(fact => <li key={fact.id} className="flex flex-col gap-1">
              <MarkdownContent generated content={fact.text} />
              <p className="text-xs text-muted-foreground">{fact.audience.kind === "public" ? t.builderEveryone
                : fact.audience.kind === "unresolved" ? t.builderUnresolvedAccess
                  : `${t.builderKnownBy}: ${fact.audience.participantIds.map(id => value.participants.find(participant => participant.id === id)?.name ?? id).join(", ")}`}</p>
            </li>)}
          </ul> : <p className="text-sm text-muted-foreground">{t.builderNoSourceFacts}</p>}
        </CardContent>
      </Card>
      {value.situation.assumptions.length ? <ReviewCard title={t.builderAssumptions} paragraphs={value.situation.assumptions} /> : null}
    </div>
    <SourceEvidence key={value.id} setId={value.documentSetId} revision={value.documentRevision}
      ids={value.sourceEvidenceIds} documents={documents} t={t} />
  </section>
}

function ReviewCard({ title, paragraphs, assumptions, t }: { title: string; paragraphs: string[]; assumptions?: string[]; t?: UiTexts }) {
  return <Card size="sm"><CardHeader><CardTitle><h3>{title}</h3></CardTitle></CardHeader>
    <CardContent className="flex flex-col gap-2">
      {paragraphs.map((paragraph, index) => <MarkdownContent generated key={index} content={paragraph} />)}
      {assumptions?.length && t ? <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground"><h4>{t.builderAssumptions}</h4>{assumptions.map((assumption, index) => <MarkdownContent generated key={index} content={assumption} />)}</div> : null}
    </CardContent>
  </Card>
}
