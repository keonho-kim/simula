/**
 * Purpose: Collect source files and options before starting scenario creation.
 * Pattern: Controlled form composition.
 * Usage: Rendered before shared scenario generation starts.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/components/scenario-builder/scenario-builder-dialog.tsx
 */
import { useRef } from "react"
import { PlusIcon, XIcon, UploadIcon } from "lucide-react"
import { DOCUMENT_FORMATS, type DocumentRecord } from "@/shared/documents"
import { SITUATION_PRESETS, type SituationPreset } from "@/shared/scenario-builder"
import type { useDocumentScenario } from "@/ui/hooks/use-document-scenario"
import type { UiTexts } from "@/ui/types/i18n"
import { Button } from "@/ui/components/ui/button"
import { Input } from "@/ui/components/ui/input"
import { Textarea } from "@/ui/components/ui/textarea"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/ui/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/ui/select"
import { Switch } from "@/ui/components/ui/switch"
import { Badge } from "@/ui/components/ui/badge"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { scenarioSourceName } from "@/ui/models/scenario-builder/source-name"

export function DocumentScenarioForm({ workflow: w, t }: { workflow: ReturnType<typeof useDocumentScenario>; t: UiTexts }) {
  const input = useRef<HTMLInputElement>(null)
  const presets: Record<SituationPreset, string> = { auto: t.builderPresetAuto, meeting: t.builderPresetMeeting, presentation: t.builderPresetPresentation, negotiation: t.builderPresetNegotiation, review: t.builderPresetReview }
  const locked = w.busy || w.pendingGeneration || !w.hydrated || w.error === "storage"
  const storedDocuments = w.documents?.documents ?? []
  const ready = (w.files.length > 0 || storedDocuments.length > 0 || !!w.form.context.trim()) && storedDocuments.every(document => document.status === "ready" || document.status === "partial")
  return <form className="document-builder-form" onSubmit={event => { event.preventDefault(); void w.execute() }}>
    <FieldSet disabled={locked}>
      <FieldLegend>{t.builderFiles}</FieldLegend>
      <FieldDescription>{t.builderFileHint}</FieldDescription>
      <input ref={input} type="file" multiple accept={DOCUMENT_FORMATS.map(format => `.${format}`).join(",")} className="sr-only" aria-label={t.builderChooseFiles}
        onChange={event => { void w.chooseFiles(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = "" }} />
      <Button type="button" variant="outline" onClick={() => input.current?.click()}><UploadIcon data-icon="inline-start" />{t.builderChooseFiles}</Button>
      <ul className="document-builder-files">
        {w.files.map((file, index) => <li key={`${file.name}-${index}`}>
          <span className="min-w-0 flex-1 break-all">{file.name}</span>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={t.builderRemoveFile} onClick={() => w.removeFile(index)}><XIcon /></Button>
        </li>)}
        {w.documents?.documents.map(document => <li key={document.id} className="flex-wrap">
          <span className="min-w-0 flex-1 break-all">{scenarioSourceName(document.name, t)}</span>
          <Badge variant="outline">{builderLabel(document.status, t)}</Badge>
          {document.status === "processing" || document.status === "uploaded" ? <Button type="button" size="sm" variant="ghost" onClick={() => void w.controlFile(document.id, "cancel")}>{t.builderCancelReading}</Button> : null}
          {["uploaded", "failed", "canceled", "partial"].includes(document.status) ? <Button type="button" size="sm" variant="outline" onClick={() => void w.controlFile(document.id, "extract")}>{t.builderReadAgain}</Button> : null}
          {document.status === "failed" || document.status === "partial" ? <p className="w-full text-xs text-muted-foreground">{readingHint(document, t)}</p> : null}
        </li>)}
      </ul>
    </FieldSet>
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="document-context">{t.builderContext}</FieldLabel>
        <FieldDescription>{t.builderContextHelp}</FieldDescription>
        <Textarea id="document-context" value={w.form.context} maxLength={1600} disabled={locked} placeholder={t.builderContextPlaceholder}
          onChange={event => w.setForm(current => ({ ...current, context: event.target.value }))} />
      </Field>
      <div className="flex min-w-0 flex-col gap-5 md:flex-row">
        <Field className="min-w-0 md:flex-1">
          <FieldLabel htmlFor="document-situation">{t.builderSituation}</FieldLabel>
          <Select value={w.form.situation} disabled={locked} onValueChange={value => { const preset = SITUATION_PRESETS.find(preset => preset === value); if (preset) w.setForm(current => ({ ...current, situation: preset })) }}>
            <SelectTrigger id="document-situation"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>{SITUATION_PRESETS.map(preset => <SelectItem key={preset} value={preset}>{presets[preset]}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal" className="min-w-0 md:flex-1">
          <FieldContent>
            <FieldLabel htmlFor="document-fast-mode">{t.builderFastMode}</FieldLabel>
            <FieldDescription>{t.builderFastModeHelp}</FieldDescription>
          </FieldContent>
          <div className="flex min-h-11 shrink-0 items-center px-3">
            <Switch id="document-fast-mode" checked={w.form.fastMode} disabled={locked} onCheckedChange={fastMode => w.setForm(current => ({ ...current, fastMode }))} />
          </div>
        </Field>
      </div>
      <FieldSet disabled={locked}>
        <FieldLegend>{t.builderParticipants}</FieldLegend>
        <FieldDescription>{t.builderParticipantHelp}</FieldDescription>
        {w.form.participants.map((participant, index) => <FieldGroup key={index} className="document-builder-participant">
          <Field data-invalid={!!participant.personality?.trim() && !participant.name.trim()}>
            <FieldLabel htmlFor={`document-name-${index}`}>{t.builderParticipantName}</FieldLabel>
            <Input id={`document-name-${index}`} value={participant.name} maxLength={80} required={!!participant.personality?.trim()}
              aria-invalid={!!participant.personality?.trim() && !participant.name.trim()}
              onChange={event => w.setForm(current => ({ ...current, participants: current.participants.map((value, position) => position === index ? { ...value, name: event.target.value } : value) }))} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`document-traits-${index}`}>{t.builderParticipantPersonality}</FieldLabel>
            <Input id={`document-traits-${index}`} value={participant.personality ?? ""} maxLength={500}
              onChange={event => w.setForm(current => ({ ...current, participants: current.participants.map((value, position) => position === index ? { ...value, personality: event.target.value } : value) }))} />
          </Field>
          <Button type="button" size="sm" variant="ghost" onClick={() => w.setForm(current => ({ ...current, participants: current.participants.filter((_, position) => position !== index) }))}>{t.builderRemoveParticipant}</Button>
        </FieldGroup>)}
        <Button type="button" variant="outline" disabled={w.form.participants.length >= 12} onClick={() => w.setForm(current => ({ ...current, participants: [...current.participants, { name: "" }] }))}><PlusIcon data-icon="inline-start" />{t.builderAddParticipant}</Button>
      </FieldSet>
      {w.documents?.documents.some(document => document.status === "partial") ? <Alert><AlertDescription>{t.builderPartialHelp}</AlertDescription></Alert> : null}
      <Button type="submit" disabled={!ready || locked || w.refreshing}>{t.builderExecute}</Button>
      {locked ? <p role="status" className="text-sm text-muted-foreground">{t.builderPreparing}</p> : null}
    </FieldGroup>
  </form>
}

function readingHint(document: DocumentRecord, t: UiTexts): string {
  if (document.status === "failed") return t.builderReadFailedHelp
  return t.builderPartialHelp
}
