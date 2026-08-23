# AI Technical Readout

A small desktop app you run on your PC. Paste an [OpenRouter](https://openrouter.ai/) key, name an asset, pick short-term (4h) or long-term (daily), and get a markdown readout of the technicals — plus a counter-read and a short definition of what actually moved the call.

It is **not** a website and **not** a hosted API. Nothing is stored on our servers. The window starts compact and grows when the sheet is ready.

Quick AI LLC FOSS. It sits next to [InferProof One](https://inferproof.one); it is not a miner.

None of this is financial advice.

## Install (Windows)

Download the latest installer from [Releases](https://github.com/Quick-AI-LLC/AI-Technical-Readout/releases/latest).

The build is unsigned. Windows SmartScreen may warn on first run — More info → Run anyway.

## Use

1. Open **AI Technical Readout**.
2. Paste an OpenRouter API key (once). It stays on this machine.
3. Look up a Binance USDT pair and confirm it.
4. Short term or long term.
5. Read the sheet. Save Markdown or HTML opens a Save As dialog.

Settings: rotate or clear the key, Infer / Dark / Light, Grok (default) / DeepSeek / GLM.

## From source

Contributors only. Node 20+.

```
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Do not run `npm run desktop` on a personal Windows machine. Installers are built by [GitHub Actions](https://github.com/Quick-AI-LLC/AI-Technical-Readout/actions) (`Windows installer` workflow). Publish the draft Release when you’ve checked it.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
