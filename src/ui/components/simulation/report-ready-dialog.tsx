/**
 * Purpose: Offer report navigation when a simulation finishes.
 * Pattern: Controlled dialog component.
 * Usage: Rendered by the application composition for the selected completed run.
 * Related: src/ui/shell/app.tsx
 */
import type { UiTexts } from "@/ui/types/i18n"
import { Button } from "@/ui/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/components/ui/dialog"

export function ReportReadyDialog({ open, t, onDismiss, onReport }: { open: boolean; t: UiTexts; onDismiss: () => void; onReport: () => void }) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onDismiss() }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t.reportConfirmTitle}</DialogTitle><DialogDescription>{t.reportConfirmDescription}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={onDismiss}>{t.reportConfirmStay}</Button><Button onClick={onReport}>{t.reportConfirmOpen}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
