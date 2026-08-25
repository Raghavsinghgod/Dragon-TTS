import * as ort from "onnxruntime-web"
import { getStoredVocab, getWeights, saveWeights } from "@/lib/db"

export const vocab = Array.from(" abcdefghijklmnopqrstuvwxyz'")

const sampleRate = 16000
const fftSize = 512
const winLen = 400
const hop = 160
const nMels = 80

function hamming(n: number): Float32Array {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++)
    w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))
  return w
}

function hzToMel(hz: number): number {
  return 1127 * Math.log(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (Math.exp(mel / 1127) - 1)
}

function melFilterbank(): Float32Array[] {
  const nFftBins = fftSize / 2 + 1
  const fMin = 20
  const fMax = (sampleRate / 2) * 0.95
  const mMin = hzToMel(fMin)
  const mMax = hzToMel(fMax)
  const points: number[] = []
  for (let i = 0; i < nMels + 2; i++) {
    const hz = melToHz(mMin + ((mMax - mMin) * i) / (nMels + 1))
    points.push((hz * fftSize) / sampleRate)
  }
  const filters: Float32Array[] = []
  for (let m = 0; m < nMels; m++) {
    const f = new Float32Array(nFftBins)
    const left = points[m]
    const center = points[m + 1]
    const right = points[m + 2]
    for (let k = 0; k < nFftBins; k++) {
      if (k >= left && k <= center && center > left)
        f[k] = (k - left) / (center - left)
      else if (k > center && k <= right && right > center)
        f[k] = (right - k) / (right - center)
    }
    filters.push(f)
  }
  return filters
}

let re: Float32Array | null = null
let im: Float32Array | null = null
let rev: Uint32Array | null = null
const twiddleCos: Float32Array[] = []
const twiddleSin: Float32Array[] = []

function initFft() {
  if (re) return
  re = new Float32Array(fftSize)
  im = new Float32Array(fftSize)
  rev = new Uint32Array(fftSize)
  const bits = Math.log2(fftSize)
  for (let i = 0; i < fftSize; i++) {
    let r = 0
    for (let b = 0; b < bits; b++)
      if (i & (1 << b)) r |= 1 << (bits - 1 - b)
    rev![i] = r
  }
  for (let size = 2, s = 0; size <= fftSize; size <<= 1, s++) {
    const half = size >> 1
    const step = (-2 * Math.PI) / size
    const cosT = new Float32Array(half)
    const sinT = new Float32Array(half)
    for (let k = 0; k < half; k++) {
      cosT[k] = Math.cos(step * k)
      sinT[k] = Math.sin(step * k)
    }
    twiddleCos[s] = cosT
    twiddleSin[s] = sinT
  }
}

function fft() {
  initFft()
  const n = fftSize
  for (let i = 0; i < n; i++) {
    const j = rev![i]
    if (j > i) {
      let tmp = re![i]
      re![i] = re![j]
      re![j] = tmp
      tmp = im![i]
      im![i] = im![j]
      im![j] = tmp
    }
  }
  for (let size = 2, s = 0; size <= n; size <<= 1, s++) {
    const half = size >> 1
    const cosTable = twiddleCos[s]
    const sinTable = twiddleSin[s]
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cosTable[k]
        const wi = sinTable[k]
        const i = start + k
        const j = i + half
        const xr = re![j] * wr - im![j] * wi
        const xi = re![j] * wi + im![j] * wr
        re![j] = re![i] - xr
        im![j] = im![i] - xi
        re![i] += xr
        im![i] += xi
      }
    }
  }
}

const window = hamming(winLen)
const filters = melFilterbank()
const power = new Float32Array(fftSize / 2 + 1)

export function frameCount(pcmLen: number): number {
  if (pcmLen < winLen) return 0
  return Math.floor((pcmLen - winLen) / hop) + 1
}

export function logMelFrame(pcm: Float32Array, start: number, out: Float32Array): void {
  initFft()
  for (let i = 0; i < fftSize; i++) {
    re![i] = i < winLen ? pcm[start + i] * window[i] : 0
    im![i] = 0
  }
  fft()
  const bins = fftSize / 2 + 1
  for (let k = 0; k < bins; k++)
    power[k] = (re![k] * re![k] + im![k] * im![k]) / fftSize
  for (let m = 0; m < nMels; m++) {
    const f = filters[m]
    let sum = 0
    for (let k = 0; k < bins; k++) sum += f[k] * power[k]
    out[m] = Math.log(sum + 1e-6)
  }
}

export async function blobToPcm(
  blob: Blob,
  makeCtx: () => AudioContext = () => new AudioContext(),
  Ctx?: typeof OfflineAudioContext,
): Promise<{ pcm: Float32Array; duration: number }> {
  const buf = await blob.arrayBuffer()
  const ctx = makeCtx()
  const decoded = await ctx.decodeAudioData(buf.slice(0))
  await ctx.close()
  return resampleToMono(decoded, Ctx)
}

async function resampleToMono(
  buffer: AudioBuffer,
  Ctx: typeof OfflineAudioContext = globalThis.OfflineAudioContext,
): Promise<{ pcm: Float32Array; duration: number }> {
  const target = 16000
  const channels = buffer.numberOfChannels
  const monoLen = buffer.length * channels
  const mono = new Float32Array(monoLen)
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    mono.set(data, c * buffer.length)
  }
  if (buffer.sampleRate === target && channels === 1) {
    return { pcm: mono.slice(0, buffer.length), duration: buffer.duration }
  }
  const offline = new Ctx(1, Math.ceil(buffer.duration * target), target)
  const src = offline.createBufferSource()
  const merged = offline.createBuffer(1, monoLen, buffer.sampleRate)
  merged.copyToChannel(mono, 0)
  src.buffer = merged
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return {
    pcm: rendered.getChannelData(0).slice(),
    duration: rendered.duration,
  }
}

export function normalizePcm(pcm: Float32Array): Float32Array {
  const out = new Float32Array(pcm.length)
  if (!pcm.length) return out
  let sum = 0
  for (let i = 0; i < pcm.length; i++) sum += pcm[i]
  const mean = sum / pcm.length
  let varSum = 0
  for (let i = 0; i < pcm.length; i++) {
    const d = pcm[i] - mean
    varSum += d * d
  }
  const std = Math.sqrt(varSum / pcm.length) || 1
  for (let i = 0; i < pcm.length; i++) out[i] = (pcm[i] - mean) / std
  return out
}

export function ctcGreedy(logits: Float32Array, nFrames: number): string {
  const blank = 0
  let prev = blank
  let out = ""
  for (let t = 0; t < nFrames; t++) {
    let best = 0
    let bestScore = -Infinity
    for (let v = 0; v < vocab.length; v++) {
      const score = logits[t * vocab.length + v]
      if (score > bestScore) {
        bestScore = score
        best = v
      }
    }
    if (best !== blank && best !== prev) out += vocab[best]
    prev = best
  }
  return out.trim().replace(/\s+/g, " ")
}

function packPaddedLogits(
  logits: Float32Array,
  nFrames: number,
  stride: number,
  vocabSize: number,
): Float32Array {
  const flat = new Float32Array(nFrames * vocabSize)
  for (let t = 0; t < nFrames; t++)
    for (let v = 0; v < vocabSize; v++)
      flat[t * vocabSize + v] = logits[t * stride + v]
  return flat
}

const mockWords = [
  "dragon",
  "local",
  "voice",
  "text",
  "offline",
  "hold",
  "steady",
  "ember",
  "iron",
  "quiet",
]

function energyAt(feats: Float32Array, t: number): number {
  let sum = 0
  for (let m = 0; m < 80; m++) sum += feats[t * 80 + m]
  return sum
}

function frameEnergies(feats: Float32Array, nFrames: number): Float32Array {
  const out = new Float32Array(nFrames)
  for (let t = 0; t < nFrames; t++) out[t] = energyAt(feats, t)
  return out
}

function voicedRuns(
  energies: Float32Array,
  floor: number,
): [number, number][] {
  const runs: [number, number][] = []
  let start = -1
  for (let t = 0; t <= energies.length; t++) {
    const voiced = t < energies.length && energies[t] > floor
    if (voiced && start < 0) start = t
    else if (!voiced && start >= 0) {
      runs.push([start, t])
      start = -1
    }
  }
  return runs
}

function mockWord(feats: Float32Array, start: number, end: number): string {
  let h = 2166136261
  for (let i = start; i < end; i += 3)
    h =
      (Math.imul(h ^ Math.round(feats[i * 80] * 997), 16777619) >>> 0) %
      100003
  return mockWords[h % mockWords.length]
}

function energyThreshold(e: Float32Array): number {
  if (!e.length) return 0
  const sorted = Float32Array.from(e).sort()
  const p85 = sorted[Math.floor(0.85 * (sorted.length - 1))]
  return p85 * 0.5
}

function mockDecode(feats: Float32Array, nFrames: number): string {
  const e = frameEnergies(feats, nFrames)
  const words: string[] = []
  for (const [start, end] of voicedRuns(e, energyThreshold(e))) {
    if (end - start >= 4) words.push(mockWord(feats, start, end))
  }
  return words.join(" ")
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function levenshtein(a: string[], b: string[]): number {
  const prev = new Array<number>(b.length + 1)
  const cur = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j]
  }
  return prev[b.length]
}

function distanceRate(
  hyp: string,
  ref: string,
  unit: (s: string) => string[],
): number {
  const h = unit(normalizeText(hyp))
  const r = unit(normalizeText(ref))
  if (r.length === 0 && h.length === 0) return 0
  if (r.length === 0 || h.length === 0) return 1
  return levenshtein(h, r) / r.length
}

export function wer(hyp: string, ref: string): number {
  return distanceRate(hyp, ref, (s) => s.split(/\s+/))
}

export function cer(hyp: string, ref: string): number {
  return distanceRate(hyp, ref, (s) => [...s])
}

export const modelCard = {
  name: "dragon-stt",
  params: "95m",
  sizeMb: 90.9,
  quant: "int8 dynamic",
  vocabSize: vocab.length,
  base: "wav2vec2-base-960h · apache-2.0",
}

export type engineState = "cold" | "loading" | "ready" | "mock"
export type engineSource = "stored" | "bundled" | "mock"

let session: ort.InferenceSession | null = null
let state: engineState = "cold"
let source: engineSource = "mock"
let rawMode = false
let stateListeners: ((s: engineState) => void)[] = []

function setState(s: engineState) {
  state = s
  stateListeners.forEach((fn) => fn(s))
}

export function getEngineState() {
  return state
}

export function onEngineState(fn: (s: engineState) => void): () => void {
  stateListeners.push(fn)
  return () => {
    stateListeners = stateListeners.filter((f) => f !== fn)
  }
}

export function getEngineSource(): engineSource {
  return source
}

ort.env.wasm.wasmPaths = "/ort/"
ort.env.wasm.numThreads = 1

async function weightsExist(): Promise<boolean> {
  try {
    const res = await fetch("/models/dragon-stt.onnx", { method: "HEAD" })
    const type = res.headers.get("content-type") ?? ""
    return res.ok && !type.includes("text/html")
  } catch {
    return false
  }
}

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0))

export async function resetEngine(): Promise<void> {
  if (session) await session.release().catch(() => undefined)
  session = null
  source = "mock"
  rawMode = false
  setState("cold")
}

const sessionOpts = {
  executionProviders: ["wasm"] as string[],
  graphOptimizationLevel: "all" as const,
}

async function loadVocab(): Promise<void> {
  const storedChars = await getStoredVocab()
  if (storedChars) {
    vocab.length = 0
    vocab.push(...storedChars)
    modelCard.vocabSize = storedChars.length
    return
  }
  try {
    const res = await fetch("/models/vocab.json")
    if (!res.ok) return
    const chars = (await res.json()) as string[]
    if (!Array.isArray(chars) || !chars.includes("")) return
    vocab.length = 0
    vocab.push(...chars)
    modelCard.vocabSize = chars.length
  } catch {
    return
  }
}

export async function loadEngine(): Promise<engineState> {
  if (state !== "cold") return state
  await loadVocab()
  setState("loading")
  const stored = await getWeights()
  if (stored) {
    try {
      session = await ort.InferenceSession.create(
        new Uint8Array(stored.bytes),
        sessionOpts,
      )
      source = "stored"
      rawMode = session.inputNames[0] === "input_values"
      setState("ready")
      return state
    } catch (e) {
      console.warn("dragon stt: installed weights failed to load", e)
      session = null
    }
  }
  if (!(await weightsExist())) {
    setState("mock")
    return state
  }
  try {
    session = await ort.InferenceSession.create(
      "/models/dragon-stt.onnx",
      sessionOpts,
    )
    source = "bundled"
    rawMode = session.inputNames[0] === "input_values"
    setState("ready")
  } catch (e) {
    console.warn("dragon stt: bundled weights failed to load", e)
    setState("mock")
  }
  return state
}

const featureChunk = 500

async function extractFeatures(
  pcm: Float32Array,
): Promise<{ feats: Float32Array; nFrames: number }> {
  const nFrames = frameCount(pcm.length)
  const feats = new Float32Array(nFrames * 80)
  const row = new Float32Array(80)
  for (let t = 0; t < nFrames; t++) {
    logMelFrame(pcm, t * 160, row)
    feats.set(row, t * 80)
    if (t % featureChunk === featureChunk - 1) await yieldToUi()
  }
  return { feats, nFrames }
}

const chunkFrames = 800

async function runModel(feats: Float32Array, nFrames: number): Promise<string> {
  let text = ""
  for (let start = 0; start < nFrames; start += chunkFrames) {
    const end = Math.min(start + chunkFrames, nFrames)
    const slice = feats.slice(start * 80, end * 80)
    const input = new ort.Tensor("float32", slice, [1, end - start, 80])
    const out = await session!.run({ inputs: input })
    const logits = out.logits.data as Float32Array
    const dims = out.logits.dims as number[]
    const framesInSlice = dims[1]
    const stride = dims[2]
    const flat = packPaddedLogits(logits, framesInSlice, stride, vocab.length)
    text += ctcGreedy(flat, framesInSlice) + " "
    await yieldToUi()
  }
  return text.trim().replace(/\s+/g, " ")
}

const rawChunkSamples = 16000 * 25

async function runRaw(pcm: Float32Array): Promise<string> {
  const normed = normalizePcm(pcm)
  const inputName = session!.inputNames[0]
  const outputName = session!.outputNames[0]
  let text = ""
  for (let start = 0; start < normed.length; start += rawChunkSamples) {
    const slice = normed.slice(
      start,
      Math.min(start + rawChunkSamples, normed.length),
    )
    const input = new ort.Tensor("float32", slice, [1, slice.length])
    const out = await session!.run({ [inputName]: input })
    const logits = out[outputName].data as Float32Array
    const dims = out[outputName].dims as number[]
    const framesInSlice = dims[1]
    const stride = dims[2]
    const flat = packPaddedLogits(logits, framesInSlice, stride, vocab.length)
    text += ctcGreedy(flat, framesInSlice) + " "
    await yieldToUi()
  }
  return text.trim().replace(/\s+/g, " ")
}

export async function warmup(): Promise<void> {
  if (state === "cold") await loadEngine()
  const seconds = 0.5
  const pcm = new Float32Array(Math.round(seconds * 16000))
  if (session && rawMode) {
    await runRaw(pcm)
    return
  }
  const { feats, nFrames } = await extractFeatures(pcm)
  if (session) await runModel(feats, nFrames)
  else mockDecode(feats, nFrames)
}

export async function transcribe(
  pcm: Float32Array,
  onStage: (stage: string) => void,
): Promise<{ text: string; modelVer: string }> {
  if (state === "cold") await loadEngine()
  if (session && rawMode) {
    onStage("running dragon stt")
    await yieldToUi()
    const text = await runRaw(pcm)
    onStage("done")
    return {
      text: text || "(silence)",
      modelVer: "dragon-stt wav2vec2 int8 v1.0.0",
    }
  }
  onStage("extracting features")
  const { feats, nFrames } = await extractFeatures(pcm)
  onStage("running dragon stt")
  await yieldToUi()
  let text: string
  if (session) text = await runModel(feats, nFrames)
  else text = mockDecode(feats, nFrames)
  onStage("done")
  return {
    text: text || "(silence)",
    modelVer: session
      ? "dragon-stt int8 v1.0.0"
      : "dragon-stt mock v0.1.0",
  }
}

export const remoteWeightsUrl =
  "https://huggingface.co/Xenova/wav2vec2-base-960h/resolve/main/onnx/model_quantized.onnx"

function joinBytes(parts: Uint8Array[], total: number): ArrayBuffer {
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out.buffer
}

async function downloadWeights(
  url: string,
  onPct: (pct: number | null) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`status ${res.status}`)
  const total = Number(res.headers.get("content-length")) || 0
  if (res.body && total > 0) {
    const reader = res.body.getReader()
    const parts: Uint8Array[] = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
      received += value.length
      onPct(Math.round((received / total) * 100))
    }
    onPct(null)
    return joinBytes(parts, received)
  }
  const buf = await res.arrayBuffer()
  onPct(null)
  return buf
}

export async function installWeightsFromUrl(
  url: string,
  onPct: (pct: number | null) => void,
): Promise<number> {
  const bytes = await downloadWeights(url, onPct)
  await saveWeights(bytes, url)
  await resetEngine()
  return bytes.byteLength
}
