/**
 * Purpose: Ask how to leave an edited modal without silently losing changes.
 * Pattern: Shared confirmation dialog.
 * Usage: Mounted by settings and scenario editing dialogs on a close attempt.
 * Related: src/ui/components/ui/dialog.tsx, src/ui/i18n/messages/common.ts
 */
import type { UiTexts } from "@/ui/types/i18n"
import { Button } from "@/ui/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/ui/components/ui/dialog"

export function UnsavedChangesDialog({ open, busy, error, t, onSave, onDiscard, onContinue }: {
  open: boolean
  busy?: boolean
  error?: string
  t: UiTexts
  onSave: () => void
  onDiscard: () => void
  onContinue: () => void
}) {
  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) onContinue() }}>
    <DialogContent showCloseButton={false} className="sm:max-w-[420px]">
      <DialogTitle>{t.unsavedChangesTitle}</DialogTitle>
      <DialogDescription>{t.unsavedChangesDescription}</DialogDescription>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={onContinue}>{t.continueEditing}</Button>
        <Button variant="outline" disabled={busy} onClick={onDiscard}>{t.discardAndClose}</Button>
        <Button disabled={busy} onClick={onSave}>{t.saveAndClose}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
