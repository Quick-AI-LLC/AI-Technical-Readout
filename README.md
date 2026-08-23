# AI Technical Readout

A small desktop app. You run it on your PC. Paste an [OpenRouter](https://openrouter.ai/) key, name an asset, pick short-term (4h) or long-term (daily), and get a markdown readout of the technicals — plus a counter-read and a short definition of what actually moved the call.

It is **not** a website and **not** a hosted API. Nothing is stored on our servers. The window starts compact and grows when the sheet is ready.

Quick AI LLC FOSS. It sits next to [InferProof One](https://inferproof.one); it is not a miner.

None of this is financial advice.

## Use

1. Open the app.
2. Paste an OpenRouter API key (once). It stays in `%APPDATA%\ai-technical-readout\` on Windows.
3. Look up a Binance USDT pair and confirm it.
4. Short term or long term.
5. Read the sheet. Export `.md` or `.html` if you want a copy.

Settings: rotate or clear the key, Infer / Dark / Light, Grok (default) / DeepSeek / GLM.

A packaged Windows build is the distribution we want people on. That wrap is next.

## From source

For now, while the desktop wrap is in progress:

```
npm install
npm run dev
```

Then open `http://127.0.0.1:5173`. Node 20+. This is how you hack on it, not how end users are meant to live in it.

`npm run start:prod` builds the UI and serves it from `http://127.0.0.1:8787`.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
