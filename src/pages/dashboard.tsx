import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Activity,
  ArrowRight,
  Ban,
  Check,
  Circle,
  CircleDot,
  Copy,
  KeyRound,
  ListFilter,
  Plus,
  RotateCcw,
  Terminal,
  Timer,
  Trash2,
  TrendingUp,
} from "@/icons"
import { Link } from "react-router"
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Skeleton } from "@/ui"
import { Shell } from "@/components/shell"
import { dailyCounts, dayMs } from "@/lib/keys"
import { listEntries, type historyEntry } from "@/lib/db"
import { getProfile } from "@/lib/db"
import {
  createKey,
  deleteKey,
  getActiveKeyId,
  listKeys,
  maskSecret,
  setActiveKey,
  setRevoked,
  type apiKey,
} from "@/lib/keys"

const quickstart = `const { pcm } = await blobToPcm(recorded)\nconst { text, modelVer } = await transcribe(pcm, (stage) => log(stage))`

function copySecret(secret: string) {
  navigator.clipboard.writeText(secret).then(
    () => toast.success("key copied"),
    () => toast.error("copy failed"),
  )
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function fmtAgo(ts: number | null): string {
  if (!ts) return "never"
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return fmtDate(ts)
}

function Sparkbars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts)
  return (
    <svg
      viewBox={`0 0 ${counts.length * 12} 44`}
      className="h-11 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="transcriptions per day"
    >
      {counts.map((c, i) => {
        const h = c === 0 ? 3 : Math.max(6, Math.round((c / max) * 32))
        const peak = c > 0 && c === max
        const x = i * 12 + 1
        return (
          <g key={i}>
            <rect
              x={x}
              y={44 - h}
              width={8}
              height={h}
              rx={1.5}
              className={c === 0 ? "fill-muted" : peak ? "fill-primary" : "fill-primary/60"}
            >
              <title>{`${peak ? "peak · " : ""}${c} runs`}</title>
            </rect>
            {peak && (
              <circle cx={x + 4} cy={44 - h - 4} r={2} className="fill-primary">
                <title>{`peak · ${c} runs`}</title>
              </circle>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default function Dashboard() {
  const [entries, setEntries] = useState<historyEntry[] | null>(null)
  const [keys, setKeys] = useState<apiKey[] | null>(() => listKeys())
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [revealed, setRevealed] = useState<apiKey | null>(null)
  const [liveId, setLiveId] = useState<string | null>(() => getActiveKeyId())
  const [scope, setScope] = useState("live")
  const [chartDays, setChartDays] = useState(7)
  const [loadedAt, setLoadedAt] = useState(0)

  useEffect(() => {
    listEntries()
      .then((all) => {
        setEntries(all)
        setLoadedAt(Date.now())
      })
      .catch(() => toast.error("could not load usage"))
  }, [])

  const loaded = entries !== null && keys !== null
  const totalSeconds = entries?.reduce((acc, e) => acc + e.duration, 0) ?? 0
  const activeKeys = keys?.filter((k) => !k.revoked).length ?? 0
  const liveKey = keys?.find((k) => k.id === liveId && !k.revoked) ?? null
  const scopeKey =
    scope === "live"
      ? liveKey
      : scope === "all"
        ? null
        : (keys?.find((k) => k.id === scope) ?? null)
  const scopeRuns = useMemo(
    () =>
      entries === null
        ? []
        : scopeKey
          ? scopeKey.runs
          : scope === "all"
            ? entries.map((e) => e.createdAt)
            : [],
    [entries, scopeKey, scope],
  )
  const scopeLabel = scopeKey
    ? scope === "live"
      ? `${scopeKey.name} · live`
      : scopeKey.name
    : scope === "all"
      ? "all keys"
      : scope === "live"
        ? "no live key"
        : "deleted key"
  const emptyText =
    scope === "all"
      ? "no runs yet."
      : scopeKey
        ? `no runs yet for ${scopeKey.name}.`
        : scope === "live"
          ? "mark a key live to chart it."
          : "this key was deleted."

  const stats: [string, string, typeof Activity][] = [
    ["transcriptions", loaded ? String(entries!.length) : "", Activity],
    ["audio processed", loaded ? `${(totalSeconds / 60).toFixed(1)} min` : "", Timer],
    ["active keys", loaded ? String(activeKeys) : "", KeyRound],
  ]

  function mint() {
    const key = createKey(newName)
    setKeys(listKeys())
    setCreateOpen(false)
    setNewName("")
    setRevealed(key)
    toast.success("api key minted")
  }

  function toggleRevoke(key: apiKey) {
    setRevoked(key.id, !key.revoked)
    setKeys(listKeys())
    toast.success(key.revoked ? "key restored" : "key revoked")
  }

  function removeKey(id: string) {
    deleteKey(id)
    setKeys(listKeys())
    if (liveId === id) {
      setActiveKey(null)
      setLiveId(null)
    }
    toast.success("key deleted")
  }

  function toggleLive(key: apiKey) {
    if (liveId !== key.id) {
      if (key.revoked) {
        toast.error("restore the key first")
        return
      }
      setActiveKey(key.id)
      setLiveId(key.id)
      toast.success(`${key.name} is live`)
    } else {
      setActiveKey(null)
      setLiveId(null)
      toast.success("key unmarked")
    }
  }

  return (
    <Shell>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">developer console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          local workspace · signed in as {getProfile() || "anon"} · nothing leaves this device
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map(([label, value, Icon]) => (
          <Card key={label} className="border-border/60 transition-shadow hover:shadow-lg hover:shadow-primary/10">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                <span className="text-xs uppercase tracking-widest">{label}</span>
              </div>
              {loaded ? (
                <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
              ) : (
                <Skeleton className="mt-2 h-8 w-24" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" />
            usage
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-border/60">
              {[7, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`px-2 py-1 font-mono text-xs transition-colors ${
                    chartDays === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{scopeRuns.length} runs</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 font-mono text-xs">
                  <ListFilter className="size-3.5" />
                  {scopeLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setScope("live")}>
                  live key
                  {scope === "live" && <Check className="ml-auto size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setScope("all")}>
                  all keys
                  {scope === "all" && <Check className="ml-auto size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(keys ?? []).map((k) => (
                  <DropdownMenuItem key={k.id} onClick={() => setScope(k.id)}>
                    {k.name}
                    {k.revoked ? " (revoked)" : ""}
                    {scope === k.id && <Check className="ml-auto size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {!loaded ? (
            <Skeleton className="h-11 w-full" />
          ) : scopeRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <>
              <Sparkbars counts={dailyCounts(scopeRuns, chartDays)} />
              <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{fmtDay(loadedAt - (chartDays - 1) * dayMs)}</span>
                <span>today</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">api keys</CardTitle>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            mint key
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            one key per project that embeds the dragon runtime. mark one as live and every studio
            transcription ticks its counter. keys are generated and stored in this browser only —
            they never leave the device.
          </p>
          {keys === null ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : keys.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">no keys yet. mint one for your next build.</p>
          ) : (
            <div className="mt-2 divide-y divide-border/60">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{maskSecret(k.secret)}</p>
                  </div>
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    title={k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : undefined}
                  >
                    used {fmtAgo(k.lastUsedAt)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{k.uses} runs</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(k.createdAt)}</span>
                  {k.revoked ? (
                    <Badge variant="outline" className="text-muted-foreground">revoked</Badge>
                  ) : (
                    <Badge className="border border-primary/30 bg-primary/15 text-primary">active</Badge>
                  )}
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title={liveId === k.id ? "unmark live key" : "mark as live key"}
                      onClick={() => toggleLive(k)}
                    >
                      {liveId === k.id ? (
                        <CircleDot className="size-4 text-primary" />
                      ) : (
                        <Circle className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="copy full key"
                      onClick={() => copySecret(k.secret)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title={k.revoked ? "restore key" : "revoke key"}
                      onClick={() => toggleRevoke(k)}
                    >
                      {k.revoked ? <RotateCcw className="size-4" /> : <Ban className="size-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="delete key"
                      onClick={() => removeKey(k.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" />
            wire it up
          </CardTitle>
          <Link
            to="/docs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            embed guide
            <ArrowRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>
              copy <code className="font-mono text-foreground">src/stt</code> and{" "}
              <code className="font-mono text-foreground">public/ort</code> into your app
            </li>
            <li>
              bundle weights at{" "}
              <code className="font-mono text-foreground">public/models/dragon-stt.onnx</code> with
              vocab.json
            </li>
            <li>call the runtime from anywhere</li>
          </ol>
          <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background p-4 font-mono text-xs leading-relaxed">
            {quickstart}
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">recent runs</CardTitle>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            all history
            <ArrowRight className="size-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries === null ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">no runs yet.</p>
          ) : (
            entries.slice(0, 3).map((e) => (
              <div key={e.id} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="truncate text-sm">{e.text || "(empty)"}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {fmtDate(e.createdAt)} · {e.duration.toFixed(1)}s · {e.modelVer}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>mint api key</DialogTitle>
            <DialogDescription>name the project that will embed the dragon runtime.</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && mint()}
            placeholder="jarvis voice loop"
          />
          <DialogFooter>
            <Button onClick={mint}>mint key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revealed !== null} onOpenChange={(open) => !open && setRevealed(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{revealed?.name}</DialogTitle>
            <DialogDescription>
              copy the secret now. it is shown once and lives only in this browser.
            </DialogDescription>
          </DialogHeader>
          <pre className="break-all rounded-lg border border-border/60 bg-background p-3 font-mono text-xs select-all">
            {revealed?.secret}
          </pre>
          <DialogFooter>
            <Button variant="secondary" onClick={() => revealed && copySecret(revealed.secret)}>
              copy
            </Button>
            <Button onClick={() => setRevealed(null)}>done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  )
}
