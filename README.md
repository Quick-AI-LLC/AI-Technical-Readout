# AI Technical Readout

Local LLM readout of technical indicators. A Quick AI LLC FOSS tool. It sits next to the InferProof One ecosystem; it is not a miner.

You run it on your machine. You bring an [OpenRouter](https://openrouter.ai/) API key. Data comes from Binance public USDT klines. Inference is yours.

None of this is financial advice.

## Run

Requires Node 20+.

```
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Production-style (build UI, one process):

```
npm run start:prod
```

Then open `http://127.0.0.1:8787`.

The API key, theme, and model choice are stored only in a local config file (`%APPDATA%\ai-technical-readout\config.json` on Windows). Analyses are not saved unless you export them.

## Use

1. Paste an OpenRouter key.
2. Look up an asset, confirm the USDT pair.
3. Short term (4h) or Long term (daily).
4. Read the markdown sheet. Export `.md` or `.html` if you want a copy.

Settings: rotate or clear the key, Infer / Dark / Light, Grok (default) / DeepSeek / GLM.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
