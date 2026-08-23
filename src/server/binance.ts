import type { Ohlcv } from "./indicators.js";

const BASE = "https://data-api.binance.vision";

export type PairMatch = {
  pair: string;
  base: string;
  quote: string;
};

type ExchangeInfo = {
  symbols: Array<{
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
  }>;
};

let cachedPairs: { at: number; list: PairMatch[] } | null = null;
const PAIR_TTL_MS = 6 * 60 * 60 * 1000;

async function loadUsdtPairs(): Promise<PairMatch[]> {
  const now = Date.now();
  if (cachedPairs && now - cachedPairs.at < PAIR_TTL_MS) return cachedPairs.list;
  const res = await fetch(`${BASE}/api/v3/exchangeInfo`);
  if (!res.ok) throw new Error(`Binance exchangeInfo failed (${res.status})`);
  const data = (await res.json()) as ExchangeInfo;
  const list = data.symbols
    .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT" && !s.symbol.includes("_"))
    .map((s) => ({ pair: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));
  cachedPairs = { at: now, list };
  return list;
}

export async function searchPairs(query: string): Promise<PairMatch[]> {
  const q = query.trim().toUpperCase().replace(/[\/\-]/g, "").replace(/USDT$/, "");
  if (!q) return [];
  const list = await loadUsdtPairs();
  const exact = list.filter((p) => p.base === q);
  if (exact.length) return exact.slice(0, 8);
  const starts = list.filter((p) => p.base.startsWith(q) || p.pair.startsWith(q));
  const rest = list.filter(
    (p) => !starts.includes(p) && (p.base.includes(q) || p.pair.includes(q)),
  );
  return [...starts, ...rest].slice(0, 8);
}

export async function fetchKlines(pair: string, interval: "4h" | "1d", closedCount: number): Promise<Ohlcv> {
  const limit = Math.min(closedCount + 1, 1000);
  const url = `${BASE}/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines failed (${res.status})`);
  const rows = (await res.json()) as Array<Array<string | number>>;
  if (!Array.isArray(rows) || rows.length < 20) {
    throw new Error("Not enough closed candles on this pair");
  }
  const now = Date.now();
  const closed = rows.filter((r) => Number(r[6]) <= now);
  const take = closed.slice(-closedCount);
  return {
    openTime: take.map((r) => Number(r[0])),
    close: take.map((r) => Number(r[4])),
    high: take.map((r) => Number(r[2])),
    low: take.map((r) => Number(r[3])),
    volume: take.map((r) => Number(r[5])),
    closeTime: take.map((r) => Number(r[6])),
  };
}
