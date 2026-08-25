import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Play } from "@/icons"
import { toast } from "sonner"
import { Button, Card, CardContent, Input, Kbd } from "@/ui"
import { Waveform } from "@/components/waveform"
import { Shell } from "@/components/shell"
import { blobToPcm, getEngineState, onEngineState, transcribe, installWeightsFromUrl, remoteWeightsUrl } from "@/stt/engine"
import { addEntry, getProfile, setProfile } from "@/lib/db"
import { recordKeyUse } from "@/lib/keys"

const stages = ["decoding audio", "extracting features", "running dragon stt", "done"]

export default function Studio() {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [pcm, setPcm] = useState<Float32Array | null>(null)
  const [stage, setStage] = useState<string>("idle")
  const [result, setResult] = useState<{ text: string; modelVer: string; duration: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [profileName, setProfileName] = useState(getProfile())
  const [engineState, setEngineState] = useState(getEngineState())
  const [fetchPct, setFetchPct] = useState<number | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => onEngineState(setEngineState), [])

  async function fetchWeights() {
    setFetchPct(0)
    try {
      await installWeightsFromUrl(remoteWeightsUrl, setFetchPct)
      toast.success("real weights installed · transcribe again")
    } catch {
      toast.error("fetch failed · check connection")
    } finally {
      setFetchPct(null)
    }
  }

  const loadBlob = useCallback(async (blob: Blob) => {
    setBusy(true)
    setStage("decoding audio")
    try {
      const { pcm: data, duration } = await blobToPcm(blob)
      setPcm(data)
      setStage("idle")
      if (duration < 0.3) toast.error("audio too short")
    } catch {
      toast.error("could not decode audio")
      setStage("error")
    } finally {
      setBusy(false)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const node = ctx.createAnalyser()
      node.fftSize = 2048
      src.connect(node)
      setAnalyser(node)
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        await ctx.close()
        setAnalyser(null)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        await loadBlob(blob)
      }
      recorder.start()
      recorderRef.current = recorder
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
      setRecording(true)
      setResult(null)
    } catch {
      toast.error("microphone unavailable")
    }
  }, [loadBlob])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    setStage("decoding audio")
  }, [])

  const onUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024 * 1024) {
      toast.error("audio too large (200 mb max)")
      e.target.value = ""
      return
    }
    setResult(null)
    await loadBlob(file)
    e.target.value = ""
  }, [loadBlob])

  const runTranscribe = useCallback(async () => {
    if (!pcm || busy) return
    setBusy(true)
    setResult(null)
    try {
      const out = await transcribe(pcm, setStage)
      setResult({ ...out, duration: pcm.length / 16000 })
      await addEntry({
        text: out.text,
        duration: pcm.length / 16000,
        createdAt: Date.now(),
        modelVer: out.modelVer,
      })
      recordKeyUse()
      toast.success("saved to history")
    } catch {
      toast.error("transcription failed")
      setStage("error")
    } finally {
      setBusy(false)
    }
  }, [pcm, busy])

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("copied"),
      () => toast.error("copy failed"),
    )
  }

  function exportTxt() {
    if (!result) return
    const blob = new Blob([result.text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "dragon-stt.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  function fmt(s: number): string {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      const key = e.key.toLowerCase()
      if (key === "r") {
        e.preventDefault()
        if (recording) stopRecording()
        else if (!busy) void startRecording()
      } else if (key === "t" && pcm && !busy && !recording) {
        e.preventDefault()
        void runTranscribe()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [recording, busy, pcm, startRecording, stopRecording, runTranscribe])

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">studio</h1>
      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span>profile</span>
        <Input
          value={profileName}
          onChange={(e) => {
            setProfileName(e.target.value)
            setProfile(e.target.value)
          }}
          placeholder="local only"
          className="w-40 h-8"
        />
      </div>

      <Card className="mt-6 border-border/60">
        <CardContent className="pt-6 space-y-4">
          <Waveform analyser={analyser} pcm={pcm} active={recording} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {recording ? (
              <Button variant="destructive" onClick={stopRecording} className="gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                stop ({fmt(elapsed)})
                <Kbd className="border border-white/30 bg-white/10 text-white">r</Kbd>
              </Button>
            ) : (
              <Button onClick={startRecording} disabled={busy} className="gap-2">
                <Mic className="size-4" />
                record
                <Kbd className="border border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">r</Kbd>
              </Button>
            )}
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
              upload audio
              <input type="file" accept="audio/*" onChange={onUpload} className="hidden" />
            </label>
            <Button onClick={runTranscribe} disabled={!pcm || busy || recording} className="gap-2">
              <Play className="size-4" />
              transcribe
              <Kbd className="border border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">t</Kbd>
            </Button>
          </div>
          <div className="text-xs font-mono">
            {stage === "idle" ? (
              pcm ? (
                <span className="text-muted-foreground">
                  loaded {(pcm.length / 16000).toFixed(1)}s · ready
                </span>
              ) : (
                <span className="text-muted-foreground">no audio yet</span>
              )
            ) : stage === "done" ? (
              <span className="text-primary">done</span>
            ) : stage === "error" ? (
              <span className="text-destructive">failed</span>
            ) : (
              stages.slice(0, stages.indexOf(stage) + 1).map((s, i, arr) => (
                <span key={s} className={i === arr.length - 1 ? "text-primary" : "text-muted-foreground"}>
                  {s}
                  {i < arr.length - 1 ? " -> " : ""}
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {engineState === "mock" && (
        <Card className="mt-6 border-primary/40">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm">
              real weights are not loaded on this device — transcription ran on the mock decoder.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={fetchWeights} disabled={fetchPct !== null} className="gap-2">
                {fetchPct !== null ? `fetching ${fetchPct}%` : "fetch real weights once · 91 mb"}
              </Button>
              <span className="text-xs text-muted-foreground">
                streams once from huggingface into local indexeddb, then runs offline forever
              </span>
            </div>
            {fetchPct !== null && (
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${fetchPct}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-6 border-border/60">
          <CardContent className="pt-6 space-y-4">
            <p className="whitespace-pre-wrap min-h-12">{result.text}</p>
            <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
              <span>
                {result.duration.toFixed(1)}s · {result.modelVer}
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => copyText(result.text)}>
                  copy
                </Button>
                <Button size="sm" variant="secondary" onClick={exportTxt}>
                  export .txt
                </Button>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </Shell>
  )
}
