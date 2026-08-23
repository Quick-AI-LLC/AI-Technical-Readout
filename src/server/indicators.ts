export type Ohlcv = {
  close: number[];
  high: number[];
  low: number[];
  volume: number[];
  openTime: number[];
  closeTime: number[];
};

export type IndicatorSet = {
  bollinger: { upper: number; middle: number; lower: number; assessment: string };
  sma: {
    sma_20: number | null;
    sma_50: number | null;
    sma_200: number | null;
    trend: string;
  };
  ema: {
    ema_20: number | null;
    ema_50: number | null;
    ema_200: number | null;
    trend: string;
  };
  vwma: { vwma_20: number | null; comparison: string };
  rsi: { value: number; zone: string; assessment: string };
  macd: { macd: number; signal: number; histogram: number; trend: string };
  atr: { value: number; assessment: string };
  stochastic: { percent_k: number; assessment: string };
  fractals: { bullish: boolean; bearish: boolean; assessment: string };
  volume: { latest: number; average_20: number | null; assessment: string };
};

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function cashDecimals(lastClose: number): number {
  const a = Math.abs(lastClose);
  if (a >= 1) return 2;
  if (a >= 0.1) return 4;
  if (a >= 0.01) return 5;
  if (a >= 0.0001) return 8;
  return 10;
}

function px(n: number, lastClose: number): number {
  return round(n, cashDecimals(lastClose));
}

function oscPx(n: number, lastClose: number): number {
  return round(n, Math.min(10, cashDecimals(lastClose) + 4));
}

function smaAt(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function stdevAt(values: number[], period: number): number | null {
  const mean = smaAt(values, period);
  if (mean === null) return null;
  const slice = values.slice(-period);
  const v = slice.reduce((s, p) => s + (p - mean) ** 2, 0) / period;
  return Math.sqrt(v);
}

function emaSeries(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = e;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

function lastValid(series: number[]): number | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (Number.isFinite(series[i])) return series[i];
  }
  return null;
}

function rsiWilder(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateAllIndicators(df: Ohlcv): IndicatorSet {
  const close = df.close;
  const n = close.length;
  const last = close[n - 1];

  const sma20 = smaAt(close, 20);
  const sma50 = smaAt(close, 50);
  const sma200 = smaAt(close, 200);
  const std20 = stdevAt(close, 20);

  let bbAssess = "insufficient bars";
  let upper = 0;
  let middle = 0;
  let lower = 0;
  if (sma20 !== null && std20 !== null) {
    middle = sma20;
    upper = sma20 + 2 * std20;
    lower = sma20 - 2 * std20;
    const pctMid = ((last - middle) / middle) * 100;
    if (last > upper) {
      const pct = ((last - upper) / upper) * 100;
      bbAssess = `price above upper band (+${pct.toFixed(1)}%) — stretched`;
    } else if (last < lower) {
      const pct = ((last - lower) / lower) * 100;
      bbAssess = `price below lower band (${pct.toFixed(1)}%) — stretched`;
    } else {
      bbAssess = `price ${pctMid >= 0 ? "above" : "below"} middle band (${Math.abs(pctMid).toFixed(1)}%) — ${pctMid >= 0 ? "mild bullish bias" : "mild bearish bias"}`;
    }
  }

  const ema20s = emaSeries(close, 20);
  const ema50s = emaSeries(close, 50);
  const ema200s = emaSeries(close, 200);
  const ema20 = lastValid(ema20s);
  const ema50 = lastValid(ema50s);
  const ema200 = lastValid(ema200s);

  const smaTrend =
    sma50 === null ? "insufficient bars" : last > sma50 ? "bullish (above SMA 50)" : "bearish (below SMA 50)";
  const emaTrend =
    ema50 === null ? "insufficient bars" : last > ema50 ? "bullish (above EMA 50)" : "bearish (below EMA 50)";

  let vwma20: number | null = null;
  let vwmaComp = "volume data unavailable";
  if (df.volume.length >= 20) {
    const c = close.slice(-20);
    const v = df.volume.slice(-20);
    const sumPV = c.reduce((s, pxv, i) => s + pxv * v[i], 0);
    const sumV = v.reduce((a, b) => a + b, 0);
    if (sumV > 0) {
      vwma20 = sumPV / sumV;
      vwmaComp =
        last > vwma20
          ? "volume-weighted price above SMA — bullish confirmation"
          : "volume-weighted price below SMA — bearish confirmation";
    }
  }

  const rsiVal = rsiWilder(close, 14);
  let rsiZone = "Neutral";
  let rsiAssessment = "neutral momentum";
  if (rsiVal > 70) {
    rsiZone = "Overbought";
    rsiAssessment = "stretched to the upside";
  } else if (rsiVal < 30) {
    rsiZone = "Oversold";
    rsiAssessment = "stretched to the downside";
  }

  const ema12 = emaSeries(close, 12);
  const ema26 = emaSeries(close, 26);
  const macdLine: number[] = close.map((_, i) =>
    Number.isFinite(ema12[i]) && Number.isFinite(ema26[i]) ? ema12[i] - ema26[i] : NaN,
  );
  const macdValid = macdLine.filter((x) => Number.isFinite(x));
  const signalSeries = emaSeries(macdValid, 9);
  const macdLast = macdValid[macdValid.length - 1] ?? 0;
  const signalLast = lastValid(signalSeries) ?? macdLast;
  const hist = macdLast - signalLast;
  const macdTrend = hist > 0 ? "bullish momentum" : "bearish momentum";

  let atrVal = 0;
  let atrAssess = "ATR data unavailable";
  if (df.high.length === n && df.low.length === n && n > 15) {
    const trs: number[] = [];
    for (let i = 1; i < n; i++) {
      trs.push(
        Math.max(
          df.high[i] - df.low[i],
          Math.abs(df.high[i] - close[i - 1]),
          Math.abs(df.low[i] - close[i - 1]),
        ),
      );
    }
    const atr = smaAt(trs, 14);
    if (atr !== null) {
      atrVal = atr;
      const pct = last > 0 ? (atr / last) * 100 : 0;
      atrAssess = pct > 4 ? "elevated volatility" : pct < 1.5 ? "compressed volatility" : "normal volatility";
    }
  }

  const stochPeriod = 14;
  const recent = close.slice(-stochPeriod);
  const hi = Math.max(...recent);
  const lo = Math.min(...recent);
  const k = hi === lo ? 50 : ((last - lo) / (hi - lo)) * 100;
  const stochAssess = k > 80 ? "overbought" : k < 20 ? "oversold" : "neutral";

  let bullish = false;
  let bearish = false;
  let fracAssess = "no confirmed fractal on the last closed bars";
  if (n >= 5) {
    const i = n - 3;
    const lows = df.low;
    const highs = df.high;
    bullish =
      lows[i] < lows[i - 2] &&
      lows[i] < lows[i - 1] &&
      lows[i] < lows[i + 1] &&
      lows[i] < lows[i + 2];
    bearish =
      highs[i] > highs[i - 2] &&
      highs[i] > highs[i - 1] &&
      highs[i] > highs[i + 1] &&
      highs[i] > highs[i + 2];
    if (bullish && bearish) fracAssess = "both a bullish and bearish fractal printed (choppy)";
    else if (bullish) fracAssess = "bullish fractal confirmed (local low)";
    else if (bearish) fracAssess = "bearish fractal confirmed (local high)";
  }

  const volLatest = df.volume[n - 1] ?? 0;
  const volAvg = smaAt(df.volume, 20);
  let volAssess = "volume data present";
  if (volAvg && volAvg > 0) {
    const ratio = volLatest / volAvg;
    if (ratio > 1.5) volAssess = "last bar volume above the 20-bar average";
    else if (ratio < 0.7) volAssess = "last bar volume below the 20-bar average";
    else volAssess = "last bar volume near the 20-bar average";
  }

  return {
    bollinger: {
      upper: px(upper, last),
      middle: px(middle, last),
      lower: px(lower, last),
      assessment: bbAssess,
    },
    sma: {
      sma_20: sma20 === null ? null : px(sma20, last),
      sma_50: sma50 === null ? null : px(sma50, last),
      sma_200: sma200 === null ? null : px(sma200, last),
      trend: smaTrend,
    },
    ema: {
      ema_20: ema20 === null ? null : px(ema20, last),
      ema_50: ema50 === null ? null : px(ema50, last),
      ema_200: ema200 === null ? null : px(ema200, last),
      trend: emaTrend,
    },
    vwma: {
      vwma_20: vwma20 === null ? null : px(vwma20, last),
      comparison: vwmaComp,
    },
    rsi: {
      value: round(rsiVal, 2),
      zone: rsiZone,
      assessment: rsiAssessment,
    },
    macd: {
      macd: oscPx(macdLast, last),
      signal: oscPx(signalLast, last),
      histogram: oscPx(hist, last),
      trend: macdTrend,
    },
    atr: { value: px(atrVal, last), assessment: atrAssess },
    stochastic: { percent_k: round(k, 2), assessment: stochAssess },
    fractals: { bullish, bearish, assessment: fracAssess },
    volume: {
      latest: round(volLatest, 2),
      average_20: volAvg === null ? null : round(volAvg, 2),
      assessment: volAssess,
    },
  };
}

export { px };
