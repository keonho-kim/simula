import { AlertCircleIcon, MessageSquareTextIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRunStore } from "@/store/run-store"

export function ActivityRail() {
  const events = useRunStore((state) => state.liveEvents)
  const actorMessages = events.filter((event) => event.type === "actor.message")

  return (
    <aside className="flex min-h-0 flex-col rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="font-heading text-sm font-semibold">Activity</h2>
        <p className="mt-1 text-xs text-muted-foreground">Speech and execution signals from the live stream.</p>
      </div>

      <Tabs defaultValue="actors" className="min-h-0 flex-1 gap-0">
        <div className="px-3 pt-3">
          <TabsList className="grid h-8 w-full grid-cols-2 rounded-md bg-muted/60 p-0.5">
            <TabsTrigger value="actors" className="h-7 rounded-sm text-xs">
              <MessageSquareTextIcon />
              Actors
            </TabsTrigger>
            <TabsTrigger value="log" className="h-7 rounded-sm text-xs">
              <AlertCircleIcon />
              Log
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="actors" className="min-h-0 flex-1 p-3">
          <ScrollArea className="h-[560px] pr-3">
            <div className="flex flex-col gap-3">
              {actorMessages.length ? (
                actorMessages.map((event, index) =>
                  event.type === "actor.message" ? (
                    <Alert key={`${event.actorId}-${index}`} className="rounded-md bg-background/70">
                      <AlertTitle>{event.actorName}</AlertTitle>
                      <AlertDescription>{event.content}</AlertDescription>
                    </Alert>
                  ) : null
                )
              ) : (
                <EmptyActivity title="No actor messages" body="Actor speech will arrive here during runtime." />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="log" className="min-h-0 flex-1 p-3">
          <ScrollArea className="h-[560px] pr-3">
            <div className="flex flex-col gap-2 font-mono text-xs">
              {events.length ? (
                events.map((event, index) => (
                  <div
                    key={`${event.type}-${index}`}
                    className="rounded-md bg-background/70 px-2 py-1.5 ring-1 ring-border/50"
                  >
                    <span className="text-muted-foreground">{event.timestamp}</span>{" "}
                    <span className="font-medium text-foreground">{event.type}</span>
                  </div>
                ))
              ) : (
                <EmptyActivity title="No stream events" body="Engine lifecycle events will appear here." />
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  )
}

function EmptyActivity({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/80 bg-muted/30 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  )
}
