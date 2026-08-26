# dragon stt

https://dragon-stt.vercel.app/

speech to text that runs entirely in your browser. no server, no account, no api calls. record or upload audio, get text back. after the first load it works with the network off.

## what it does

- record from your mic with a live waveform display
- upload audio files up to 200mb
- transcription happens inside the browser tab via webassembly
- all history saves to indexeddb on your device
- mint api keys from the console and track usage with charts
- install your own model weights from a url or from disk
- works offline after first visit, pwa ready

## how it works

audio comes in as a blob from the mic or an uploaded file. it gets resampled to 16khz mono float32, then runs through a wav2vec2 model in 25-second chunks so long clips dont freeze the page. ctc greedy decode turns the raw model output into readable text. everything runs in webassembly inside your tab. nothing leaves the browser.

the bundled model is wav2vec2-base-960h, int8 dynamic quantized, 91mb, 95m parameters. it loads into indexeddb on first run so repeat visits skip the download. you can swap in your own weights from the model page — any wav2vec2 onnx export with a matching vocab.json works.

## pages

`/studio` — record, upload, transcribe
`/console` — api keys, usage charts, embed guide
`/history` — browse past transcriptions stored locally
`/model` — model info, warmup, install custom weights
`/docs` — integration reference for embedding the runtime

## stack

react 19, typescript, vite 7, tailwind css 4, onnxruntime-web. persistence in indexeddb and localstorage. single dependency for inference: onnxruntime-web. no backend, no database, no cloud functions.

## running locally
