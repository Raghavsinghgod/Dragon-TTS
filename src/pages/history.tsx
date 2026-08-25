import { useEffect, useState } from "react"
import { FileAudio } from "@/icons"
import { Link } from "react-router"
import { toast } from "sonner"
import { Button, Card, CardContent, Skeleton } from "@/ui"
import { Shell } from "@/components/shell"
import { deleteEntry, listEntries, type historyEntry } from "@/lib/db"

export default function HistoryPage() {
  const [entries, setEntries] = useState<historyEntry[] | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    listEntries()
      .then(setEntries)
      .catch(() => toast.error("could not load history"))
  }, [])

  async function remove(id: number) {
    await deleteEntry(id)
    setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null)
    toast.success("deleted")
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("copied"),
      () => toast.error("copy failed"),
    )
  }

  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleString()
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">history</h1>
      <div className="mt-6 space-y-3">
        {entries === null && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {entries !== null && entries.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 py-12 text-center">
            <FileAudio className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">no transcriptions yet.</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/studio">open studio</Link>
            </Button>
          </div>
        )}
        {entries?.map((e) => {
          const open = openId === e.id
          return (
            <Card key={e.id} className="border-border/60 transition-colors hover:border-primary/40">
              <CardContent className="pt-4 pb-4">
                <button
                  className="w-full text-left"
                  onClick={() => setOpenId(open ? null : e.id!)}
                >
                  <p className="truncate text-sm">{e.text || "(empty)"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDate(e.createdAt)} · {e.duration.toFixed(1)}s · {e.modelVer}
                  </p>
                </button>
                {open && (
                  <div className="mt-3 space-y-3">
                    <p className="whitespace-pre-wrap text-sm border-l-2 border-primary/40 pl-3">
                      {e.text}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copyText(e.text)}>
                        copy
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(e.id!)}>
                        delete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </Shell>
  )
}
