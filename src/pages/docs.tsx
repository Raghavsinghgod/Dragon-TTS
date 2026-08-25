import { toast } from "sonner"
import { Copy, Download } from "@/icons"
import { Link } from "react-router"
import { Button } from "@/ui"
import { Shell } from "@/components/shell"
import { bundleText, downloadBlob, makeZip, type filePair } from "@/lib/db"
import { vocab } from "@/stt/engine"

const sttSource = import.meta.glob("../stt/engine.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const starterReadme = `dragon stt runtime starter

contents
  src/stt/engine.ts   audio decode, log-mel features, ctc decode, inference
  public/models/      vocab.json template + where weights go

setup
  1. install onnxruntime-web in your host app
  2. copy its wasm binaries into public/ort/
  3. drop dragon-stt.onnx int8 weights into public/models/
  4. wire it:

       const { pcm } = await blobToPcm(recorded)
       const { text, modelVer } = await transcribe(pcm, (stage) => log(stage))

  5. kill the network after first load and confirm transcription still runs

api key
  mint a project key in the dragon console and paste it into your app config.
  keys are local identifiers only; nothing phones home.

full guide lives at /docs on the dragon stt site.`

const modelsReadme = `the bundled dragon-stt.onnx ships real wav2vec2-base
weights (librispeech, apache-2.0): raw waveform in — input input_values
[1,T] float32 at 16 khz z-score normalized per clip, output logits
[1,T,V], blank = index 0. copy it together with vocab.json.

custom exports from training/export_onnx.py use log-mel features:
input inputs [1,T,80] float32, output logits [1,T,V]. keep vocab.json
blank-first (index 0 = "") so ids match what ctcGreedy drops.`

function collectFiles(): filePair[] {
  const files: filePair[] = Object.entries(sttSource)
    .map(([k, v]) => ["src/" + k.replace(/^(?:\.\.\/)+/, ""), v] as filePair)
    .sort((a, b) => a[0].localeCompare(b[0]))
  files.push(["public/models/vocab.json", JSON.stringify(["", ...vocab.slice(1)], null, 2)])
  files.push(["public/models/readme.txt", modelsReadme])
  files.push(["readme.txt", starterReadme])
  return files
}

function downloadStarter() {
  downloadBlob(makeZip(collectFiles()), "dragon-stt-starter.zip")
  toast.success("starter.zip downloaded")
}

function copyAll() {
  navigator.clipboard.writeText(bundleText(collectFiles())).then(
    () => toast.success("all sources copied"),
    () => toast.error("copy failed"),
  )
}

const toc = [
  ["layout", "project layout"],
  ["install", "install"],
  ["audio", "audio in"],
  ["transcribe", "transcribe"],
  ["features", "features only"],
  ["reference", "reference"],
  ["keys", "api keys"],
  ["offline", "offline checklist"],
]

const layoutTree = `your-app/
  src/stt/
    engine.ts
  public/
    ort/
      ort-wasm-simd-threaded.wasm
    models/
      dragon-stt.onnx
      vocab.json`

const installCmd = `bun add onnxruntime-web`

const configureSnippet = `import * as ort from "onnxruntime-web"

ort.env.wasm.wasmPaths = "/ort/"
ort.env.wasm.numThreads = 1`

const audioSnippet = `import { blobToPcm } from "./stt/engine"

const { pcm, duration } = await blobToPcm(audioBlob)
if (duration < 0.3) throw new Error("clip too short")`

const transcribeSnippet = `import { getEngineState, transcribe, warmup } from "./stt/engine"

await warmup()

const { text, modelVer } = await transcribe(pcm, setStage)`

const featuresSnippet = `import { frameCount, logMelFrame } from "./stt/engine"

const frames = frameCount(pcm.length)
const feats = new Float32Array(frames * 80)
const row = new Float32Array(80)
for (let t = 0; t < frames; t++) {
  logMelFrame(pcm, t * 160, row)
  feats.set(row, t * 80)
}`

const reference: [string, string, string][] = [
  [
    "blobToPcm",
    "(blob: Blob) => Promise<{ pcm: Float32Array; duration: number }>",
    "decodes any browser-supported audio to mono float32 at 16 khz via offlineaudiocontext resampling",
  ],
  [
    "transcribe",
    "(pcm: Float32Array, onStage: (stage: string) => void) => Promise<{ text: string; modelVer: string }>",
    "full pipeline: log-mel, chunked inference at 800 frames, ctc greedy decode; yields between chunks so the ui never freezes",
  ],
  [
    "warmup",
    "() => Promise<void>",
    "runs a silent 0.5 s pass; call once after load so the first real request is fast",
  ],
  [
    "modelCard",
    "{ name, params, sizeMb, quant, vocabSize }",
    "bundled model metadata for display or telemetry-free diagnostics",
  ],
  [
    "getEngineState",
    '() => "cold" | "loading" | "ready" | "mock"',
    "mock means weights were absent at load time and the deterministic fallback decoder is active",
  ],
  [
    "onEngineState",
    "(fn: (s: engineState) => void) => () => void",
    "subscribe to state changes; the returned function unsubscribes",
  ],
]

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("copied"),
    () => toast.error("copy failed"),
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-border/60 bg-card p-4 pr-12 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        title="copy snippet"
        className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => copyText(code)}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export default function Docs() {
  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">docs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        embed guide · ship dragon-stt inside your own app. one source module, one package,
        zero network at runtime.
      </p>

      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        {toc.map(([id, label], i) => (
          <a
            key={id}
            href={`#${id}`}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <span className="text-primary">{String(i + 1).padStart(2, "0")}</span> {label}
          </a>
        ))}
      </nav>

      <Section id="layout" title="project layout">
        <p className="text-sm leading-relaxed text-muted-foreground">
          copy the runtime source and static assets into your app. everything is same-origin:
          wasm from <code className="font-mono">/ort</code>, weights from{" "}
          <code className="font-mono">/models</code>.
        </p>
        <CodeBlock code={layoutTree} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadStarter}>
            <Download className="size-3.5" />
            download starter.zip
          </Button>
          <Button size="sm" variant="outline" onClick={copyAll}>
            <Copy className="size-3.5" />
            copy all sources
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          the zip bundles the engine source, a matching vocab.json template and setup readmes,
          built client-side at download time. ort wasm binaries stay binary — copy them from
          onnxruntime-web dist into your public/ort folder.
        </p>
      </Section>

      <Section id="install" title="install">
        <p className="text-sm leading-relaxed text-muted-foreground">
          onnxruntime-web is the only dependency. no dsp libs, no ml frameworks.
        </p>
        <CodeBlock code={installCmd} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          engine.ts already pins the wasm path and single-thread execution, so this config is only
          needed if you roll your own session.
        </p>
        <CodeBlock code={configureSnippet} />
      </Section>

      <Section id="audio" title="audio in">
        <p className="text-sm leading-relaxed text-muted-foreground">
          feed any blob the browser can decode — mediaRecorder output, uploaded files, websocket
          chunks. it comes back as mono float32 at 16 khz.
        </p>
        <CodeBlock code={audioSnippet} />
      </Section>

      <Section id="transcribe" title="transcribe">
        <p className="text-sm leading-relaxed text-muted-foreground">
          one call runs the whole pipeline. stage callbacks arrive in order: decoding audio,
          extracting features, running dragon stt, done. wire them straight into a status line.
        </p>
        <CodeBlock code={transcribeSnippet} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          long clips never block the ui: features and inference are chunked and yield between
          chunks. check <code className="font-mono">getEngineState()</code> before relying on real
          output — <code className="font-mono">mock</code> means weights were missing.
        </p>
      </Section>

      <Section id="features" title="features only">
        <p className="text-sm leading-relaxed text-muted-foreground">
          want the mel front-end for your own downstream model? it is exported directly. stride is
          160 samples (10 ms), window 400 (25 ms).
        </p>
        <CodeBlock code={featuresSnippet} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          if you retrain the weights yourself, mirror the packing in engine.ts before
          calling <code className="font-mono">ctcGreedy</code> — padded logits must be compacted to
          vocab width first.
        </p>
      </Section>

      <Section id="reference" title="reference">
        <div className="divide-y divide-border/60 border-y border-border/60">
          {reference.map(([name, sig, note]) => (
            <div key={name} className="py-3">
              <p className="font-mono text-sm text-primary">{name}</p>
              <p className="mt-1 font-mono text-xs break-all">{sig}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="keys" title="api keys">
        <p className="text-sm leading-relaxed text-muted-foreground">
          mint one key per project in the{" "}
          <Link to="/dashboard" className="text-primary hover:underline">
            console
          </Link>{" "}
          and paste it into your app config. mark a key as live and every studio transcription
          ticks its run counter. keys are local identifiers for your builds — they are generated,
          stored and checked entirely on-device, and they never leave the browser.
        </p>
      </Section>

      <Section id="offline" title="offline checklist">
        <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>copy src/stt and public/ort into the host app</li>
          <li>place dragon-stt.onnx and vocab.json under public/models</li>
          <li>optional: install weights from any cors url or disk on the model page — fetched once into indexeddb, inference stays on device</li>
          <li>keep wasm same-origin at /ort, numThreads 1</li>
          <li>after first load, kill the network: transcription must still work</li>
        </ul>
      </Section>
    </Shell>
  )
}
