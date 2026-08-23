import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { searchPairs } from "./binance.js";
import {
  clearApiKey,
  MODELS,
  publicConfig,
  setApiKey,
  setModel,
  setTheme,
  type ModelId,
  type ThemeId,
} from "./config.js";
import { runAnalyze, type Mode } from "./analyze.js";
import { validateKey } from "./openrouter.js";

const PORT = Number(process.env.PORT) || 8787;
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../../dist");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ai-technical-readout" });
});

app.get("/api/config", (_req, res) => {
  res.json({ ...publicConfig(), models: Object.values(MODELS) });
});

app.put("/api/config/key", async (req, res) => {
  const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
  if (!key) {
    res.status(400).json({ error: "Key is required" });
    return;
  }
  try {
    await validateKey(key);
    setApiKey(key);
    res.json(publicConfig());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Key check failed" });
  }
});

app.delete("/api/config/key", (_req, res) => {
  clearApiKey();
  res.json(publicConfig());
});

app.put("/api/config/theme", (req, res) => {
  const theme = req.body?.theme as ThemeId;
  if (theme !== "infer" && theme !== "dark" && theme !== "light") {
    res.status(400).json({ error: "Theme must be infer, dark, or light" });
    return;
  }
  setTheme(theme);
  res.json(publicConfig());
});

app.put("/api/config/model", (req, res) => {
  const model = req.body?.model as ModelId;
  if (!(model in MODELS)) {
    res.status(400).json({ error: "Unknown model" });
    return;
  }
  setModel(model);
  res.json(publicConfig());
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q ?? "");
  try {
    const matches = await searchPairs(q);
    res.json({ matches });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Search failed" });
  }
});

app.post("/api/analyze", async (req, res) => {
  const pair = typeof req.body?.pair === "string" ? req.body.pair : "";
  const base = typeof req.body?.base === "string" ? req.body.base : "";
  const mode = req.body?.mode as Mode;
  if (!pair || !base || (mode !== "short" && mode !== "long")) {
    res.status(400).json({ error: "pair, base, and mode (short|long) are required" });
    return;
  }
  try {
    const result = await runAnalyze({ pair, base, mode });
    res.json({ markdown: result.markdown });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Analyze failed" });
  }
});

if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`AI Technical Readout  http://127.0.0.1:${PORT}`);
});
