import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import type { UiTexts } from "@/lib/i18n"
import { useRunStore } from "@/store/run-store"

export function ReplayDock({ t }: { t: UiTexts }) {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const setReplayIndex = useRunStore((state) => state.setReplayIndex)
  const [playing, setPlaying] = useState(false)
  const frame = timeline[replayIndex]
  const progress = timeline.length ? ((replayIndex + 1) / timeline.length) * 100 : 0

  useEffect(() => {
    if (!playing) {
      return
    }
    const timer = window.setInterval(() => {
      setReplayIndex(Math.min(replayIndex + 1, Math.max(0, timeline.length - 1)))
    }, 800)
    return () => window.clearInterval(timer)
  }, [playing, replayIndex, setReplayIndex, timeline.length])

  useEffect(() => {
    if (timeline.length && replayIndex >= timeline.length - 1) {
      setPlaying(false)
    }
  }, [replayIndex, timeline.length])

  return (
    <footer className="mb-2 rounded-lg bg-card/90 p-3 shadow-sm ring-1 ring-border/60">
      <div className="grid gap-3 lg:grid-cols-[auto_minmax(220px,1fr)_auto] lg:items-center">
        <div className="flex items-center gap-2">
          <Button
            aria-label={playing ? t.pauseReplay : t.playReplay}
            variant="outline"
            size="icon"
            disabled={!timeline.length}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            aria-label={t.resetReplay}
            variant="ghost"
            size="icon"
            disabled={!timeline.length}
            onClick={() => setReplayIndex(0)}
          >
            <RotateCcwIcon />
          </Button>
          <Badge variant="outline" className="rounded-md">
            {t.replay}
          </Badge>
        </div>

        <div className="grid gap-2">
          <Input
            aria-label={t.replayTimeline}
            type="range"
            min={0}
            max={Math.max(0, timeline.length - 1)}
            value={replayIndex}
            disabled={!timeline.length}
            onChange={(event) => setReplayIndex(Number(event.target.value))}
          />
          <Progress value={progress} className="h-1" />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground lg:justify-end">
          <span>{timeline.length ? `${replayIndex + 1}/${timeline.length}` : "0/0"}</span>
          <span className="max-w-[360px] truncate">{frame?.timestamp ?? t.noFrameSelected}</span>
        </div>
      </div>
    </footer>
  )
}
