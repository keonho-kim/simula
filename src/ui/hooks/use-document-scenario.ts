/**
 * Purpose: Start document extraction and scenario generation from one user action.
 * Pattern: Browser workflow hook.
 * Usage: Used by the lazy-loaded document scenario dialog.
 * Related: src/ui/api-client/scenario-builder.ts, src/ui/browser-storage/scenario-builder-session.ts
 */
import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { PromptLanguage } from "@/shared/scenario"
import type { BuilderRequest } from "@/shared/scenario-builder"
import { DOCUMENT_FORMATS } from "@/shared/documents"
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENTS_PER_SET } from "@/shared/documents-schema"
import * as api from "@/ui/api-client/scenario-builder"
import { RequestJsonError } from "@/ui/api-client/request-json"
import { readDocumentScenarioSession, writeDocumentScenarioSession } from "@/ui/browser-storage/scenario-builder-session"
import { USER_SITUATION_SOURCE_NAME } from "@/ui/models/scenario-builder/source-name"
import { readDraft } from "@/ui/browser-storage/database/drafts/read"
import { writeWorkingDraft } from "@/ui/browser-storage/database/drafts/write-working"
import { saveDraft } from "@/ui/browser-storage/database/drafts/save"
import { discardWorkingDraft } from "@/ui/browser-storage/database/drafts/discard-working"
import { deleteDraft } from "@/ui/browser-storage/database/drafts/delete"
import { deleteAttachment } from "@/ui/browser-storage/database/attachments/delete"
import { listDocumentAttachments } from "@/ui/browser-storage/database/attachments/list"
import { readAttachment } from "@/ui/browser-storage/database/attachments/read"
import { retainDocumentAttachment } from "@/ui/browser-storage/database/attachments/retain"
import { storeAttachment } from "@/ui/browser-storage/database/attachments/store"
import type { StoredAttachment } from "@/ui/browser-storage/database/attachments/types"

const POLL_MS = 1000
const DRAFT_ID = "new-scenario"
type BuilderForm = Pick<BuilderRequest, "context" | "situation" | "fastMode" | "participants">
const emptyForm = (): BuilderForm => ({ context: "", situation: "auto", fastMode: false, participants: [] })
interface LocalScenarioDraft { form: BuilderForm; attachments: StoredAttachment[] }
const emptyDraft = (): LocalScenarioDraft => ({ form: emptyForm(), attachments: [] })

export function useDocumentScenario(open: boolean, language: PromptLanguage) {
  const client = useQueryClient()
  const [session, setSession] = useState(readDocumentScenarioSession)
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState<File[]>([])
  const [attachments, setAttachments] = useState<StoredAttachment[]>([])
  const [savedDraft, setSavedDraft] = useState<LocalScenarioDraft>(emptyDraft)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState<"request" | "files" | "participants" | "extraction" | "storage">()
  const [busy, setBusy] = useState(false)
  const [pendingGeneration, setPendingGeneration] = useState(false)
  const uploadAbort = useRef<AbortController | undefined>(undefined)
  const loadedBuild = useRef<string | undefined>(undefined)
  const nextBuildId = useRef<string | undefined>(session.buildId)
  const initialBuildId = useRef(session.buildId)
  const documentQuery = useQuery({
    queryKey: ["document-set", session.documentSetId], enabled: (open || pendingGeneration) && !!session.documentSetId,
    queryFn: ({ signal }) => api.fetchDocumentSet(session.documentSetId ?? "", signal), retry: false,
    refetchInterval: query => pendingGeneration || query.state.data?.documents.some(document =>
      document.status === "processing" || document.status === "uploaded") ? POLL_MS : false,
  })
  const buildQuery = useQuery({
    queryKey: ["scenario-build", session.buildId], enabled: open && !!session.buildId && !busy,
    queryFn: ({ signal }) => api.fetchScenarioBuild(session.buildId ?? "", signal), retry: false,
    refetchInterval: query => query.state.data?.status === "running" ? POLL_MS : false,
  })
  useEffect(() => { writeDocumentScenarioSession(session) }, [session])
  useEffect(() => () => uploadAbort.current?.abort(), [])
  useEffect(() => {
    if (initialBuildId.current) { setHydrated(true); return }
    void readDraft<LocalScenarioDraft>(DRAFT_ID).then(async stored => {
      const working = stored?.working ?? emptyDraft()
      const restored = await Promise.all(working.attachments.map(readAttachment))
      setForm(working.form)
      setFiles(restored)
      setAttachments(working.attachments)
      setSavedDraft(stored?.saved ?? emptyDraft())
      setHydrated(true)
    }).catch(() => { setError("storage"); setHydrated(true) })
  }, [])
  useEffect(() => {
    if (!hydrated || session.buildId) return
    const draft = { form, attachments }
    void writeWorkingDraft(DRAFT_ID, "new-scenario", draft).catch(() => setError("storage"))
  }, [attachments, form, hydrated, session.buildId])
  useEffect(() => {
    const build = buildQuery.data
    if (build && loadedBuild.current !== build.id) {
      loadedBuild.current = build.id
      setForm({ context: build.request.context, situation: build.request.situation, fastMode: build.request.fastMode, participants: build.request.participants })
    }
  }, [buildQuery.data])
  useEffect(() => {
    const documents = documentQuery.data
    if (!pendingGeneration || busy || files.length || !documents || documents.id !== session.documentSetId) return
    if (documents.documents.some(document => document.status === "failed" || document.status === "canceled")) {
      setPendingGeneration(false)
      setError("extraction")
      return
    }
    if (!documents.documents.length || documents.documents.some(document => document.status !== "ready" && document.status !== "partial")) return
    setPendingGeneration(false)
    setBusy(true)
    nextBuildId.current ??= crypto.randomUUID()
    const buildId = nextBuildId.current
    const participants = form.participants.map(value => ({ name: value.name.trim(), personality: value.personality?.trim() })).filter(value => value.name)
    const pendingSession = { documentSetId: documents.id, buildId }
    writeDocumentScenarioSession(pendingSession)
    setSession(pendingSession)
    void api.startScenarioBuild({ ...form, participants, language, documentSetId: documents.id, documentRevision: documents.revision }, buildId)
      .then(build => {
        client.setQueryData(["scenario-build", build.id], build)
        setSession(current => ({ ...current, buildId: build.id }))
      })
      .catch(() => setError("request"))
      .finally(() => setBusy(false))
  }, [busy, client, documentQuery.data, files.length, form, language, pendingGeneration, session.documentSetId])

  async function chooseFiles(selected: File[]) {
    const valid = selected.every(file => file.size > 0 && file.size <= MAX_DOCUMENT_BYTES && DOCUMENT_FORMATS.some(format => file.name.toLowerCase().endsWith(`.${format}`)))
    if (!valid || files.length + selected.length + (documentQuery.data?.documents.length ?? 0) > MAX_DOCUMENTS_PER_SET) { setError("files"); return }
    setBusy(true)
    const added: StoredAttachment[] = []
    try {
      for (const file of selected) added.push(await storeAttachment(file))
      setFiles(current => [...current, ...selected])
      setAttachments(current => [...current, ...added])
      setError(undefined)
    } catch {
      await Promise.all(added.map(value => deleteAttachment(value.id)))
      setError("storage")
    } finally { setBusy(false) }
  }

  function removeFile(index: number) {
    const attachment = attachments[index]
    setFiles(current => current.filter((_, position) => position !== index))
    setAttachments(current => current.filter((_, position) => position !== index))
    if (attachment) void deleteAttachment(attachment.id).catch(() => setError("storage"))
  }

  async function execute() {
    if (busy || pendingGeneration || !hydrated || error === "storage" || (!files.length && !session.documentSetId && !form.context.trim())) return
    const participants = form.participants.map(value => ({ name: value.name.trim(), personality: value.personality?.trim() })).filter(value => value.name || value.personality)
    if (participants.some(value => !value.name)) { setError("participants"); return }
    setBusy(true); setError(undefined)
    const controller = new AbortController()
    uploadAbort.current = controller
    try {
      const oldSetId = session.documentSetId
      const activeSet = oldSetId ? await api.hasActiveDocumentSet(oldSetId, controller.signal) : false
      const recovered = oldSetId && !activeSet ? await listDocumentAttachments(oldSetId) : []
      const recoveredFiles = await Promise.all(recovered.map(readAttachment))
      const selectedFiles = [...files, ...recoveredFiles]
      if (!selectedFiles.length && (!oldSetId || !activeSet) && form.context.trim()) {
        selectedFiles.push(new File([form.context.trim()], USER_SITUATION_SOURCE_NAME, { type: "text/plain" }))
      }
      if (!selectedFiles.length && oldSetId && !activeSet) { setError("files"); return }
      const setId = activeSet && oldSetId ? oldSetId : (await api.createDocumentSet()).id
      if (setId !== oldSetId) nextBuildId.current = undefined
      setSession(current => ({ ...current, documentSetId: setId, buildId: undefined }))
      for (const file of selectedFiles) {
        controller.signal.throwIfAborted()
        const document = await api.uploadDocument(setId, file, controller.signal)
        const attachment = attachments[files.indexOf(file)] ?? recovered[recoveredFiles.indexOf(file)]
        setFiles(current => current.filter(value => value !== file))
        if (attachment) {
          setAttachments(current => current.filter(value => value.id !== attachment.id))
          await retainDocumentAttachment(attachment.id, setId)
        }
        await api.controlDocument(setId, document.id, "extract", form.fastMode)
      }
      await client.invalidateQueries({ queryKey: ["document-set", setId] })
      setPendingGeneration(true)
    } catch { if (!controller.signal.aborted) setError("request") }
    finally { setBusy(false); uploadAbort.current = undefined }
  }

  async function controlBuild(action: "retry" | "cancel" | "confirm") {
    if (!session.buildId || busy) return
    setBusy(true); setError(undefined)
    try {
      const build = await api.controlScenarioBuild(session.buildId, action)
      client.setQueryData(["scenario-build", session.buildId], action === "retry" ? { ...build, status: "running" } : build)
    }
    catch (failure) {
      if (action === "retry" && failure instanceof RequestJsonError && failure.status === 404 && buildQuery.data) {
        nextBuildId.current = undefined
        setSession({ documentSetId: buildQuery.data.request.documentSetId })
        setPendingGeneration(false)
        setError(undefined)
      } else setError("request")
    }
    finally { setBusy(false) }
  }

  async function controlFile(id: string, action: "extract" | "cancel") {
    if (!session.documentSetId || busy) return
    setBusy(true); setError(undefined)
    try { await api.controlDocument(session.documentSetId, id, action, form.fastMode); await documentQuery.refetch() }
    catch { setError("request") }
    finally { setBusy(false) }
  }

  function reset() {
    uploadAbort.current?.abort()
    nextBuildId.current = undefined
    for (const attachment of attachments) void deleteAttachment(attachment.id).catch(() => setError("storage"))
    void deleteDraft(DRAFT_ID).catch(() => setError("storage"))
    setSavedDraft(emptyDraft()); setAttachments([])
    setPendingGeneration(false); setSession({}); setForm(emptyForm()); setFiles([]); setError(undefined)
  }

  async function saveLocalDraft(): Promise<void> {
    const draft = { form, attachments }
    await saveDraft(DRAFT_ID, "new-scenario", draft)
    setSavedDraft(draft)
  }

  async function discardLocalDraft(): Promise<void> {
    await discardWorkingDraft(DRAFT_ID)
    const restored = await Promise.all(savedDraft.attachments.map(readAttachment))
    for (const attachment of attachments) {
      if (!savedDraft.attachments.some(value => value.id === attachment.id)) await deleteAttachment(attachment.id)
    }
    setForm(savedDraft.form); setFiles(restored); setAttachments(savedDraft.attachments)
  }

  const dirty = !session.buildId && hydrated && JSON.stringify({ form, attachments }) !== JSON.stringify(savedDraft)

  return { form, setForm: (update: React.SetStateAction<BuilderForm>) => { nextBuildId.current = undefined; setForm(update) }, files, chooseFiles, removeFile, execute, controlBuild, controlFile, reset,
    dirty, hydrated, saveLocalDraft, discardLocalDraft,
    busy, pendingGeneration, error: error ?? (documentQuery.isError || buildQuery.isError ? "request" : undefined),
    documents: documentQuery.data, build: buildQuery.data, hasSession: !!session.documentSetId,
    refreshing: documentQuery.isLoading || buildQuery.isLoading,
    refresh: () => { setError(undefined); if (session.documentSetId) void documentQuery.refetch(); if (session.buildId) void buildQuery.refetch() },
  }
}
