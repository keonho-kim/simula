/**
 * Purpose: Open read-only report content on one full-viewport scrolling surface.
 * Pattern: Dialog composition with deferred content mounting.
 * Usage: Wraps analytical cards and simulation inspection entry points.
 * Related: src/ui/styles/report.css, src/ui/components/ui/dialog.tsx
 */
import { useState, type ReactNode } from "react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/components/ui/dialog"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"

export function ReportDetailDialog({ title, summary, children, t }: { title: string; summary?: string; children: ReactNode; t: UiTexts }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="report-board-entry" aria-label={title}>
      <span className="flex min-w-0 flex-col gap-2"><span className="font-medium">{title}</span>
        {summary ? <span className="line-clamp-3 whitespace-normal text-xs leading-5 text-muted-foreground">{summary}</span> : null}
      </span>
    </Button></DialogTrigger>
    <DialogContent className="page-scroll-dialog" showCloseButton={false}>
      <DialogHeader className="flex-row items-start justify-between gap-4 border-b pb-3">
        <div className="flex flex-col gap-2"><DialogTitle>{title}</DialogTitle><DialogDescription>{t.analysisOpen}</DialogDescription></div>
        <DialogClose asChild><Button variant="ghost" size="sm">{t.analysisClose}</Button></DialogClose>
      </DialogHeader>
      <div className="flex min-w-0 flex-col gap-4">{open ? children : null}</div>
    </DialogContent>
  </Dialog>
}
