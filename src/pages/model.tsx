import { useEffect, useRef, useState } from "react"
import { Flame, Trash2 } from "@/icons"
import { toast } from "sonner"
import { Button, Card, CardContent, Input } from "@/ui"
import { Shell } from "@/components/shell"
import { Bench } from "@/components/bench"
import { getEngineState, getEngineSource, modelCard, onEngineState, resetEngine, warmup, installWeightsFromUrl } from "@/stt/engine"
import { clearModel, getWeights, parseVocab, saveVocab, saveWeights, type storedWeights } from "@/lib/db"

const stateLabel: Record<string, string> = {
  cold: "cold",
  loading: "loading",
  ready: "ready",
  mock: "mock decode",
}

const sourceLabel: Record<string, string> = {
  stored: "installed weights",
  bundled: "bundled /models/dragon-stt.onnx",
  mock: "mock decode",
}

export default function ModelPage() {
  const [state, setState] = useState(getEngineState())
  const [warming, setWarming] = useState(false)
  const [meta, setMeta] = useState<storedWeights | null>(null)
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState<number | null>(null)
  const weightsInput = useRef<HTMLInputElement>(null)
  const vocabInput = useRef<HTMLInputElement>(null)

  useEffect(() => onEngineState(setState), [])
  useEffect(() => {
    getWeights().then(setMeta)
  }, [])

  async function installBytes(bytes: ArrayBuffer, source: string) {
    await saveWeights(bytes, source)
    await resetEngine()
    setMeta(await getWeights())
  }

  async function installFromUrl() {
    const target = url.trim()
    if (!target) {
      toast.error("enter a weights url first")
      return
    }
    setBusy(true)
    setPct(null)
    try {
      const size = await installWeightsFromUrl(target, setPct)
      toast.success(`installed ${(size / 1048576).toFixed(1)} mb · engine reloads on next run`)
    } catch {
      toast.error("download failed · check url and cors headers")
    } finally {
      setBusy(false)
      setPct(null)
    }
  }

  async function installFromFile(file: File) {
    setBusy(true)
    try {
      await installBytes(await file.arrayBuffer(), file.name)
      toast.success("weights installed · engine reloads on next run")
    } catch {
      toast.error("could not read that file")
    } finally {
      setBusy(false)
    }
  }

  async function installVocabFile(file: File) {
    try {
      const chars = parseVocab(await file.text())
      if (!chars) {
        toast.error("invalid vocab json")
        return
      }
      await saveVocab(chars)
      await resetEngine()
      toast.success(`vocab installed · ${chars.length} tokens`)
    } catch {
      toast.error("could not read that file")
    }
  }

  async function removeInstalled() {
    setBusy(true)
    try {
      await clearModel()
      await resetEngine()
      setMeta(await getWeights())
      toast.success("installed weights removed")
    } finally {
      setBusy(false)
    }
  }

  async function runWarmup() {
    setWarming(true)
    try {
      await warmup()
      toast.success("model warm")
    } catch {
      toast.error("warmup failed")
    } finally {
      setWarming(false)
    }
  }

  const rows: [string, string][] = [
    ["name", modelCard.name],
    ["params", modelCard.params],
    ["size", `${modelCard.sizeMb} mb`],
    ["quantization", modelCard.quant],
    ["base weights", modelCard.base],
    ["vocab size", String(modelCard.vocabSize)],
    ["runtime", "onnxruntime-web wasm · 1 thread"],
  ]

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">model</h1>
      <Card className="mt-6 border-border/60">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">status</span>
            <span
              className={`inline-flex items-center gap-2 text-sm font-medium ${
                state === "ready" || state === "mock" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  state === "loading"
                    ? "animate-pulse bg-primary"
                    : state === "cold"
                      ? "bg-muted-foreground/50"
                      : "bg-primary"
                }`}
              />
              loaded / {state === "ready" ? sourceLabel[getEngineSource()] : stateLabel[state]}
            </span>
          </div>
          <div className="divide-y divide-border/60 border-t border-border/60">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
            {meta && (
              <div className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">installed</span>
                <span className="font-mono text-right">
                  {(meta.bytes.byteLength / 1048576).toFixed(1)} mb · {meta.source} ·{" "}
                  {new Date(meta.savedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
          <Button onClick={runWarmup} disabled={warming} className="gap-2">
            <Flame className={`size-4 ${warming ? "animate-pulse" : ""}`} />
            {warming ? "warming..." : "warmup"}
          </Button>
          <p className="text-xs text-muted-foreground leading-relaxed">
            real weights are bundled at /models/dragon-stt.onnx — wav2vec2-base fine-tuned on librispeech,
            int8 quantized, greedy ctc decode over a 32-char vocab. the first transcription loads them from
            same origin (~91 mb), after that everything runs offline on this device. installing external
            weights below swaps them once into local indexeddb; nothing is ever sent anywhere.
          </p>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-lg font-semibold tracking-tight">install weights</h2>
      <Card className="mt-3 border-border/60">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://huggingface.co/you/dragon-stt/resolve/main/dragon-stt.onnx"
              className="font-mono text-xs"
            />
            <Button onClick={installFromUrl} disabled={busy} className="sm:w-36 shrink-0">
              {busy && pct !== null ? `${pct}%` : "fetch & install"}
            </Button>
          </div>
          {pct !== null && (
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={weightsInput}
              type="file"
              accept=".onnx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) installFromFile(f)
                e.target.value = ""
              }}
            />
            <input
              ref={vocabInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) installVocabFile(f)
                e.target.value = ""
              }}
            />
            <Button variant="outline" onClick={() => weightsInput.current?.click()} disabled={busy}>
              install .onnx from disk
            </Button>
            <Button variant="outline" onClick={() => vocabInput.current?.click()} disabled={busy}>
              install vocab.json
            </Button>
            {meta && (
              <Button
                variant="destructive"
                onClick={removeInstalled}
                disabled={busy}
                className="gap-2 sm:ml-auto"
              >
                <Trash2 className="size-4" />
                remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            point at any cors-enabled dragon-stt.onnx exported by training/export_onnx.py, or pick it from
            disk. pair custom weights with their matching vocab.json so ctc decoding uses the same tokenizer.
            files are stored in local indexeddb and reused across sessions.
          </p>
        </CardContent>
      </Card>

      <Bench />
    </Shell>
  )
}
