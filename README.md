# Dragon-TTS
https://dragon-stt.vercel.app/
speech to text that runs in your browser. no server. no account. no api calls.

record audio or upload a file, get text back. the model lives in your tab. after first load you can go offline and it still works.

## what it does

- record from mic or upload audio (up to 200mb)
- runs wav2vec2 int8 quantized via webassembly
- shows waveform while recording
- saves history to indexeddb
- tracks usage per api key from the console
- bundles its own weights at /models, never phones home

## stack

react 19, typescript, vite, tailwind 4, framer motion, onnxruntime-web. persistence in indexeddb + localstorage.

## run it
