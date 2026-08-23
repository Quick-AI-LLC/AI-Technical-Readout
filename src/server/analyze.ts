import { fetchKlines } from "./binance.js";
import { calculateAllIndicators, px } from "./indicators.js";
import { complete } from "./openrouter.js";

export type Mode = "short" | "long";

const LOOKBACK: Record<Mode, { interval: "4h" | "1d"; bars: number }> = {
  short: { interval: "4h", bars: 300 },
  long: { interval: "1d", bars: 400 },
};

export async function runAnalyze(input: {
  pair: string;
  base: string;
  mode: Mode;
}): Promise<{ markdown: string; payload: unknown }> {
  const spec = LOOKBACK[input.mode];
  const df = await fetchKlines(input.pair, spec.interval, spec.bars);
  const notes: string[] = [];
  if (df.close.length < spec.bars) {
    notes.push(`Only ${df.close.length} closed ${spec.interval} bars available (wanted ${spec.bars}).`);
  }
  const indicators = calculateAllIndicators(df);
  const lastCloseTime = df.closeTime[df.closeTime.length - 1];
  const lastClose = df.close[df.close.length - 1];
  const payload = {
    name: input.base,
    symbol: input.base,
    pair: input.pair,
    mode: input.mode,
    interval: spec.interval,
    bar_count: df.close.length,
    as_of: new Date(lastCloseTime).toISOString(),
    price: px(lastClose, lastClose),
    indicators,
    notes,
  };
  const markdown = await complete(payload);
  return { markdown, payload };
}
