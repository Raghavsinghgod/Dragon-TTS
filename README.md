# Dragon STT

https://dragon-stt.vercel.app/

speech to text that runs in your browser. no server. no account. no api calls.

record audio or upload a file, get text back. the model lives in your tab. after first load you can go offline and it still works.

## Features

- **Offline transcription** — runs entirely in the browser via WebAssembly, zero network calls after first load
- **Mic recording** — record directly from your microphone with live waveform visualization
- **File upload** — upload audio files up to 200MB for transcription
- **Local history** — all past transcriptions saved to IndexedDB, never leaves your device
- **API key console** — mint keys per project, track usage with charts, mark keys live
- **Model management** — bundled wav2vec2 int8 weights, install custom weights from URL or disk
- **WebAssembly inference** — onnxruntime-web runs the model in a single thread inside your tab
- **PWA ready** — manifest included, works offline after first visit
- **Private by design** — no accounts, no telemetry, no data leaves the browser

## How It Works

1. Audio comes in as a blob (from mic or upload)
2. Gets resampled to 16kHz mono float32
3. Runs through the ONNX model in 25-second chunks so long clips don't freeze the page
4. CTC greedy decode converts model output to text
5. Result saves to IndexedDB history

All of this happens in WebAssembly inside your browser tab. No server involved.

## Tech Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- onnxruntime-web (WebAssembly inference)
- IndexedDB + localStorage (persistence)
- wav2vec2-base-960h int8 quantized (91MB model)

## Pages

| Route | What it does |
|-------|-------------|
| `/` | Landing page with project overview |
| `/studio` | Record from mic, upload audio, transcribe |
| `/console` | API keys, usage charts, developer tools |
| `/history` | Browse past transcriptions from IndexedDB |
| `/model` | View model info, install custom weights |
| `/docs` | Embed guide and API reference |

## Getting Started

```bash
npm install
npm run dev
```

Open localhost, allow microphone access, start talking.

## Model Details

- **Architecture:** wav2vec2-base-960h
- **Quantization:** int8 dynamic
- **Size:** 91 MB
- **Parameters:** 95M
- **Runtime:** onnxruntime-web WASM, single thread
- **License:** Apache-2.0
- **Vocab:** 28 characters (CTC blank + 27 tokens)

Weights are bundled at `/models/dragon-stt.onnx` and loaded into IndexedDB on first run. Custom weights can be installed from the model page.

## Known Issues

- Model sometimes outputs silence on certain audio formats (preprocessing mismatch between mel-spectrogram and raw PCM paths — actively debugging)
- First load is slow due to 91MB model download
- Single-threaded WASM means very long clips take time to process
- Not yet tested on mobile Safari
