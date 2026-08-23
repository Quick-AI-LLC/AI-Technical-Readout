import { calculateAllIndicators, px } from "../server/indicators";
import promptMd from "../../prompts/analysis-system.md?raw";

export function isDesktop(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

const MODELS = {
  grok: { id: "grok", label: "Grok", slug: "~x-ai/grok-latest" },
  deepseek: { id: "deepseek", label: "DeepSeek", slug: "deepseek/deepseek-v4-pro-0813" },
  glm: { id: "glm", label: "GLM", slug: "~z-ai/glm-latest" },
} as const;

type ModelId = keyof typeof MODELS;
type ThemeId = "infer" | "dark" | "light";
type Store = { apiKey?: string; theme?: ThemeId; model?: ModelId };
type PairMatch = { pair: string; base: string; quote: string };

const KEY = "atr-config";
const BINANCE = "https://data-api.binance.vision";
const OR = "https://openrouter.ai/api/v1";

let pairCache: { at: number; list: PairMatch[] } | null = null;

function readStore(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

function writeStore(data: Store): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function publicConfig() {
  const d = readStore();
  const theme: ThemeId = d.theme === "dark" || d.theme === "light" ? d.theme : "infer";
  const model: ModelId = d.model && d.model in MODELS ? d.model : "grok";
  return { theme, model, hasKey: Boolean(d.apiKey?.trim()), models: Object.values(MODELS) };
}

function systemPrompt(): string {
  const idx = promptMd.indexOf("## Prompt");
  return idx === -1 ? promptMd : promptMd.slice(idx + "## Prompt".length).trim();
}

async function http(url: string, init?: RequestInit): Promise<Response> {
  if (isDesktop()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, init);
  }
  return fetch(url, init);
}

async function loadUsdtPairs(): Promise<PairMatch[]> {
  const now = Date.now();
  if (pairCache && now - pairCache.at < 6 * 60 * 60 * 1000) return pairCache.list;
  const res = await http(`${BINANCE}/api/v3/exchangeInfo`);
  if (!res.ok) throw new Error(`Binance exchangeInfo failed (${res.status})`);
  const data = (await res.json()) as {
    symbols: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }>;
  };
  const list = data.symbols
    .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT" && !s.symbol.includes("_"))
    .map((s) => ({ pair: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));
  pairCache = { at: now, list };
  return list;
}

async function searchPairs(query: string): Promise<PairMatch[]> {
  const q = query.trim().toUpperCase().replace(/[/\-]/g, "").replace(/USDT$/, "");
  if (!q) return [];
  const list = await loadUsdtPairs();
  const exact = list.filter((p) => p.base === q);
  if (exact.length) return exact.slice(0, 8);
  const starts = list.filter((p) => p.base.startsWith(q) || p.pair.startsWith(q));
  const rest = list.filter((p) => !starts.includes(p) && (p.base.includes(q) || p.pair.includes(q)));
  return [...starts, ...rest].slice(0, 8);
}

async function validateKey(key: string): Promise<void> {
  const res = await http(`${OR}/key`, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 401 || res.status === 403) throw new Error("OpenRouter rejected that key");
  if (!res.ok) throw new Error(`OpenRouter key check failed (${res.status})`);
}

async function complete(payload: unknown, signal?: AbortSignal): Promise<string> {
  const key = readStore().apiKey?.trim();
  if (!key) throw new Error("No OpenRouter API key set");
  const model = publicConfig().model;
  const res = await http(`${OR}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/Quick-AI-LLC/AI-Technical-Readout",
      "X-Title": "AI Technical Readout",
    },
    signal,
    body: JSON.stringify({
      model: MODELS[model].slug,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (res.status === 401 || res.status === 403) throw new Error("OpenRouter rejected that key");
  if (!res.ok) throw new Error(`OpenRouter request failed (${res.status})`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((p) => p.text ?? "").join("").trim();
    if (text) return text;
  }
  throw new Error("OpenRouter returned an empty readout");
}

async function runAnalyze(pair: string, base: string, mode: "short" | "long", signal?: AbortSignal) {
  const interval = mode === "short" ? "4h" : "1d";
  const want = mode === "short" ? 300 : 400;
  const limit = Math.min(want + 1, 1000);
  const url = `${BINANCE}/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${limit}`;
  const res = await http(url, { signal });
  if (!res.ok) throw new Error(`Binance klines failed (${res.status})`);
  const rows = (await res.json()) as Array<Array<string | number>>;
  if (!Array.isArray(rows) || rows.length < 20) throw new Error("Not enough closed candles on this pair");
  const now = Date.now();
  const take = rows.filter((r) => Number(r[6]) <= now).slice(-want);
  const df = {
    openTime: take.map((r) => Number(r[0])),
    close: take.map((r) => Number(r[4])),
    high: take.map((r) => Number(r[2])),
    low: take.map((r) => Number(r[3])),
    volume: take.map((r) => Number(r[5])),
    closeTime: take.map((r) => Number(r[6])),
  };
  const notes: string[] = [];
  if (df.close.length < want) notes.push(`Only ${df.close.length} closed ${interval} bars available (wanted ${want}).`);
  const lastClose = df.close[df.close.length - 1];
  const payload = {
    name: base,
    symbol: base,
    pair,
    mode,
    interval,
    bar_count: df.close.length,
    as_of: new Date(df.closeTime[df.closeTime.length - 1]).toISOString(),
    price: px(lastClose, lastClose),
    indicators: calculateAllIndicators(df),
    notes,
  };
  return { markdown: await complete(payload, signal) };
}

export async function desktopApi(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
  if (path === "/api/config" && method === "GET") return publicConfig();
  if (path === "/api/config/key" && method === "PUT") {
    const key = body.key?.trim() ?? "";
    if (!key) throw new Error("Key is required");
    await validateKey(key);
    const d = readStore();
    d.apiKey = key;
    writeStore(d);
    return publicConfig();
  }
  if (path === "/api/config/key" && method === "DELETE") {
    const d = readStore();
    delete d.apiKey;
    writeStore(d);
    return publicConfig();
  }
  if (path === "/api/config/theme" && method === "PUT") {
    const theme = body.theme as ThemeId;
    if (theme !== "infer" && theme !== "dark" && theme !== "light") throw new Error("Theme must be infer, dark, or light");
    const d = readStore();
    d.theme = theme;
    writeStore(d);
    return publicConfig();
  }
  if (path === "/api/config/model" && method === "PUT") {
    const model = body.model as ModelId;
    if (!(model in MODELS)) throw new Error("Unknown model");
    const d = readStore();
    d.model = model;
    writeStore(d);
    return publicConfig();
  }
  if (path.startsWith("/api/search") && method === "GET") {
    const q = new URL(path, "http://local").searchParams.get("q") ?? "";
    return { matches: await searchPairs(q) };
  }
  if (path === "/api/analyze" && method === "POST") {
    const pair = body.pair ?? "";
    const base = body.base ?? "";
    const mode = body.mode as "short" | "long";
    if (!pair || !base || (mode !== "short" && mode !== "long")) {
      throw new Error("pair, base, and mode (short|long) are required");
    }
    return runAnalyze(pair, base, mode, init?.signal ?? undefined);
  }
  throw new Error("Unknown request");
}

export async function resizeWindow(wide: boolean): Promise<void> {
  if (!isDesktop()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { LogicalSize } = await import("@tauri-apps/api/dpi");
  await getCurrentWindow().setSize(new LogicalSize(wide ? 920 : 460, wide ? 880 : 680));
}
