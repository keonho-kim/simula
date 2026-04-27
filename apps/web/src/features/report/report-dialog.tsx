import { useQuery } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { fetchReport } from "@/lib/api"

interface ReportDialogProps {
  open: boolean
  selectedRunId?: string
  onOpenChange: (open: boolean) => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}

export function ReportDialog({
  open,
  selectedRunId,
  onOpenChange,
  onExport,
}: ReportDialogProps) {
  const reportQuery = useQuery({
    queryKey: ["report", selectedRunId],
    queryFn: () => fetchReport(selectedRunId ?? ""),
    enabled: open && Boolean(selectedRunId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] overflow-hidden sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>Final markdown report and run artifacts.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!selectedRunId} onClick={() => onExport("json")}>
            <DownloadIcon data-icon="inline-start" />
            Export JSON
          </Button>
          <Button variant="outline" disabled={!selectedRunId} onClick={() => onExport("jsonl")}>
            <DownloadIcon data-icon="inline-start" />
            Export JSONL
          </Button>
          <Button variant="outline" disabled={!selectedRunId} onClick={() => onExport("md")}>
            <DownloadIcon data-icon="inline-start" />
            Export Markdown
          </Button>
        </div>

        <Separator />

        <ScrollArea className="h-[58svh] rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
          <pre className="whitespace-pre-wrap text-sm leading-6">
            {reportQuery.data ?? "Run finalization has not produced a report yet."}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
