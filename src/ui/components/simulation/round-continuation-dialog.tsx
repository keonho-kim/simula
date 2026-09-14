import { useEffect, useState } from "react"
import { Button } from "@/ui/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/components/ui/dialog"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/ui/components/ui/field"
import { Switch } from "@/ui/components/ui/switch"
import type { UiTexts } from "@/ui/types/i18n"

const AUTO_CONTINUE_DELAY_MS = 5000

interface RoundContinuationDialogProps {
  autoContinue: boolean
  action?: "continue" | "cancel"
  t: UiTexts
  onAutoContinueChange: (enabled: boolean) => void
  onContinue: () => Promise<void>
  onCancel: () => Promise<void>
}

export function RoundContinuationDialog({ autoContinue, action, t, onAutoContinueChange, onContinue, onCancel }: RoundContinuationDialogProps) {
  const [seconds, setSeconds] = useState(AUTO_CONTINUE_DELAY_MS / 1000)

  useEffect(() => {
    if (!autoContinue || action) return
    const deadline = Date.now() + AUTO_CONTINUE_DELAY_MS
    setSeconds(AUTO_CONTINUE_DELAY_MS / 1000)
    const interval = window.setInterval(() => {
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }, 1000)
    const timeout = window.setTimeout(() => { void onContinue() }, AUTO_CONTINUE_DELAY_MS)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [autoContinue, action, onContinue])

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.roundContinueTitle}</DialogTitle>
          <DialogDescription>{t.roundContinueDescription}</DialogDescription>
        </DialogHeader>
        <Field orientation="horizontal" className="items-start rounded-md bg-muted/40 p-3">
          <Switch id="round-auto-continue" checked={autoContinue} disabled={Boolean(action)} onCheckedChange={onAutoContinueChange} />
          <FieldContent>
            <FieldLabel htmlFor="round-auto-continue">{t.autoContinue}</FieldLabel>
            <FieldDescription>{t.autoContinueHelp}</FieldDescription>
          </FieldContent>
        </Field>
        {autoContinue && !action ? <p role="status" className="text-center text-sm tabular-nums text-muted-foreground">{t.roundAutoCountdown.replace("{seconds}", String(seconds))}</p> : null}
        <DialogFooter className="sm:items-center">
          <Button variant="outline" disabled={Boolean(action)} onClick={() => void onCancel()}>
            {action === "cancel" ? t.roundStopPending : t.roundStop}
          </Button>
          {!autoContinue ? <Button disabled={Boolean(action)} onClick={() => void onContinue()}>
            {action === "continue" ? t.roundContinuePending : t.roundContinue}
          </Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
