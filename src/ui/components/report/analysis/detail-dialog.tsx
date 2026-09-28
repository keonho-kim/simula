/**
 * Purpose: Open read-only report content in one bounded scrolling dialog.
 * Pattern: Dialog composition with deferred content mounting.
 * Usage: Wraps analytical cards and simulation inspection entry points.
 * Related: src/ui/styles/report.css, src/ui/components/ui/dialog.tsx
 */
import { useState, type ReactNode } from "react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/ui/components/ui/dialog"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export function ReportDetailDialog({ title, summary, children, t }: { title: string; summary?: string; children: ReactNode; t: UiTexts }) {
  const [open, setOpen] = useState(false)
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="report-board-entry" aria-label={title}>
      <span className="flex min-w-0 flex-col gap-2"><span className="font-medium">{title}</span>
        {summary ? <MarkdownContent generated inline className="line-clamp-3 whitespace-normal text-xs leading-5 text-muted-foreground" content={summary} /> : null}
      </span>
    </Button></DialogTrigger>
    <DialogContent className="page-scroll-dialog page-scroll-dialog--report" overlayClassName="bg-black/25 backdrop-blur-[2px]" showCloseButton={false}>
      <DialogHeader className="flex-row items-start justify-between gap-4 border-b pb-3">
        <div className="flex flex-col gap-2"><DialogTitle>{title}</DialogTitle><DialogDescription>{t.analysisOpen}</DialogDescription></div>
        <DialogClose asChild><Button variant="ghost" size="sm">{t.analysisClose}</Button></DialogClose>
      </DialogHeader>
      <div className="flex min-w-0 flex-col gap-4">{open ? children : null}</div>
    </DialogContent>
  </Dialog>
}
