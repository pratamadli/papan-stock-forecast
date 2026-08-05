// Core forecasting & technical-analysis logic.
// Everything here is plain JS math — no external ML service required,
// so it runs fine in a Vercel serverless function or the browser.
//
// Accuracy focus (deployable): regime-aware weights, volume/ATR filters,
// stricter BUY/SELL thresholds, confidence, and walk-forward hit-rate.

const HORIZON = 10;
// Balanced: more actionable than ±2.5, still stricter than legacy ±1.5.
const ACTION_THRESHOLD = 2.0;
const CHOPPY_THRESHOLD = 2.75; // tighter when ATR% is elevated
const VOLUME_MIN_RATIO = 0.85;
const CONFIRM_BARS = 2; // MACD continuation needs 2 bars same sign

/** Calibrated weights by market regime (priors from typical TA practice). */
const WEIGHTS = {
  trending: { sma: 1.25, macd: 1.35, holt: 1.15, rsi: 0.35, bb: 0.3, rs: 0.7 },
  mixed: { sma: 1.0, macd: 1.1, holt: 0.9, rsi: 0.9, bb: 0.85, rs: 0.55 },
  sideways: { sma: 0.35, macd: 0.45, holt: 0.35, rsi: 1.35, bb: 1.25, rs: 0.4 },
};

/** Simple Moving Average over `period` days, aligned to the end of `values`. */
function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential Moving Average over `period` days. */
function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue;
    if (prev == null) {
      prev = values[i];
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

/** Relative Strength Index (Wilder's smoothing), standard 14-day period. */
function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

/** MACD line, signal line, and histogram (12/26/9 standard config). */
function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );
  const signalInput = macdLine.map((v) => (v == null ? 0 : v));
  const signalRaw = ema(signalInput, signalPeriod);
  const signal = macdLine.map((v, i) => (v == null ? null : signalRaw[i]));
  const hist = macdLine.map((v, i) =>
    v != null && signal[i] != null ? v - signal[i] : null
  );
  return { macdLine, signal, hist };
}

/**
 * Bollinger Bands (SMA ± k·σ) over `period` days.
 * Returns middle/upper/lower series and %B at each bar.
 */
function bollinger(values, period = 20, k = 2) {
  const middle = sma(values, period);
  const upper = new Array(values.length).fill(null);
  const lower = new Array(values.length).fill(null);
  const percentB = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - middle[i];
      sumSq += diff * diff;
    }
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + k * std;
    lower[i] = middle[i] - k * std;
    const width = upper[i] - lower[i];
    percentB[i] = width > 0 ? (values[i] - lower[i]) / width : 0.5;
  }

  return { middle, upper, lower, percentB };
}

/** Average True Range (Wilder), period 14. Needs high/low/close. */
function atr(highs, lows, closes, period = 14) {
  const n = closes.length;
  const out = new Array(n).fill(null);
  if (n < 2) return out;

  const tr = new Array(n).fill(null);
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(hl, hc, lc);
  }

  let sum = 0;
  for (let i = 1; i <= period && i < n; i++) sum += tr[i];
  if (n <= period) return out;
  out[period] = sum / period;
  for (let i = period + 1; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

/**
 * Holt's linear trend method (double exponential smoothing).
 * Produces a level + trend forecast for the next `horizon` days.
 */
function holtForecast(values, horizon = HORIZON, alpha = 0.3, beta = 0.15) {
  if (values.length < 2) return { fitted: [], forecast: [], level: null, trend: null };
  let level = values[0];
  let trend = values[1] - values[0];
  const fitted = [level];
  for (let i = 1; i < values.length; i++) {
    const value = values[i];
    const lastLevel = level;
    level = alpha * value + (1 - alpha) * (level + trend);
    trend = beta * (level - lastLevel) + (1 - beta) * trend;
    fitted.push(level);
  }
  const forecast = [];
  for (let h = 1; h <= horizon; h++) {
    forecast.push(level + h * trend);
  }
  return { fitted, forecast, level, trend };
}

function padSeries(values, length, fallback = 0) {
  if (!values || values.length === 0) return new Array(length).fill(fallback);
  if (values.length === length) return values;
  if (values.length > length) return values.slice(values.length - length);
  const pad = new Array(length - values.length).fill(values[0] ?? fallback);
  return pad.concat(values);
}

function detectRegime(price, sma20v, sma50v, atrv) {
  if (price == null || sma20v == null || sma50v == null || atrv == null || atrv <= 0) {
    return { regime: "mixed", trendStrength: null, atrPct: null };
  }
  const atrPct = atrv / price;
  const trendStrength = Math.abs(sma20v - sma50v) / atrv;
  let regime = "mixed";
  if (trendStrength >= 2) regime = "trending";
  else if (trendStrength <= 1) regime = "sideways";
  return { regime, trendStrength, atrPct };
}

/**
 * Precompute indicator series once for live signal + historical backtest.
 */
function computeSeries({ closes, highs, lows, volumes, indexCloses }) {
  const n = closes.length;
  const hi = padSeries(highs || closes, n, closes[0]);
  const lo = padSeries(lows || closes, n, closes[0]);
  const vol = padSeries(volumes || [], n, 0);

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsi14 = rsi(closes, 14);
  const { hist } = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const atr14 = atr(hi, lo, closes, 14);
  const volSma20 = sma(vol, 20);

  let indexSma20 = null;
  let relCloses = null;
  if (indexCloses && indexCloses.length >= 20) {
    const idx = padSeries(indexCloses, n, indexCloses[0]);
    // Relative strength series: stock / index (normalized path)
    relCloses = closes.map((c, i) => (idx[i] > 0 ? c / idx[i] : null));
    indexSma20 = sma(
      relCloses.map((v) => (v == null ? 0 : v)),
      20
    );
  }

  return { sma20, sma50, rsi14, hist, bb, atr14, vol, volSma20, relCloses, indexSma20 };
}

/**
 * Score a single bar. Used by live signal and walk-forward backtest.
 * @param {object} series from computeSeries
 * @param {number[]} closes
 * @param {number} i bar index
 * @param {{ includeForecast?: boolean }} [opts]
 */
function scoreAt(series, closes, i, opts = {}) {
  const includeForecast = opts.includeForecast !== false;
  const price = closes[i];
  const { sma20, sma50, rsi14, hist, bb, atr14, vol, volSma20, relCloses, indexSma20 } =
    series;

  const { regime, trendStrength, atrPct } = detectRegime(
    price,
    sma20[i],
    sma50[i],
    atr14[i]
  );
  const w = WEIGHTS[regime] || WEIGHTS.mixed;

  const reasons = [];
  const votes = []; // -1 | 0 | +1 per component for confidence
  let score = 0;

  // 1. SMA crossover (trend)
  if (sma20[i] != null && sma50[i] != null) {
    if (sma20[i] > sma50[i]) {
      score += w.sma;
      votes.push(1);
      if (includeForecast) reasons.push("SMA20 di atas SMA50 (tren jangka pendek naik)");
    } else {
      score -= w.sma;
      votes.push(-1);
      if (includeForecast) reasons.push("SMA20 di bawah SMA50 (tren jangka pendek turun)");
    }
  } else {
    votes.push(0);
  }

  // 2. RSI (mean reversion) — stronger weight in sideways
  if (rsi14[i] != null) {
    if (rsi14[i] < 30) {
      score += w.rsi * 1.2;
      votes.push(1);
      if (includeForecast)
        reasons.push(`RSI ${rsi14[i].toFixed(1)} (oversold, berpotensi rebound)`);
    } else if (rsi14[i] > 70) {
      score -= w.rsi * 1.2;
      votes.push(-1);
      if (includeForecast)
        reasons.push(`RSI ${rsi14[i].toFixed(1)} (overbought, rawan koreksi)`);
    } else {
      votes.push(0);
      if (includeForecast) reasons.push(`RSI ${rsi14[i].toFixed(1)} (netral)`);
    }
  }

  // 3. MACD with multi-bar confirmation
  if (hist[i] != null && i > 0 && hist[i - 1] != null) {
    if (hist[i] > 0 && hist[i - 1] <= 0) {
      score += w.macd * 1.2;
      votes.push(1);
      if (includeForecast)
        reasons.push("MACD baru saja golden cross (momentum berbalik naik)");
    } else if (hist[i] < 0 && hist[i - 1] >= 0) {
      score -= w.macd * 1.2;
      votes.push(-1);
      if (includeForecast)
        reasons.push("MACD baru saja death cross (momentum berbalik turun)");
    } else {
      let confirmed = true;
      for (let k = 0; k < CONFIRM_BARS; k++) {
        const h = hist[i - k];
        if (h == null || Math.sign(h) !== Math.sign(hist[i]) || h === 0) {
          confirmed = false;
          break;
        }
      }
      if (confirmed && hist[i] > 0) {
        score += w.macd * 0.45;
        votes.push(1);
        if (includeForecast)
          reasons.push("Histogram MACD positif terkonfirmasi (≥2 hari)");
      } else if (confirmed && hist[i] < 0) {
        score -= w.macd * 0.45;
        votes.push(-1);
        if (includeForecast)
          reasons.push("Histogram MACD negatif terkonfirmasi (≥2 hari)");
      } else {
        votes.push(0);
        if (includeForecast) reasons.push("MACD belum terkonfirmasi multi-bar");
      }
    }
  }

  // 4. Holt trend — only for live / end bar (expensive if recomputed every bar)
  let projectedChangePct = null;
  let forecast = [];
  if (includeForecast) {
    const holt = holtForecast(closes.slice(0, i + 1), HORIZON);
    forecast = holt.forecast;
    if (forecast.length && price > 0) {
      projectedChangePct = ((forecast[forecast.length - 1] - price) / price) * 100;
      if (projectedChangePct > 1) {
        score += w.holt;
        votes.push(1);
        reasons.push(
          `Proyeksi tren ${HORIZON} hari ke depan naik ~${projectedChangePct.toFixed(1)}%`
        );
      } else if (projectedChangePct < -1) {
        score -= w.holt;
        votes.push(-1);
        reasons.push(
          `Proyeksi tren ${HORIZON} hari ke depan turun ~${projectedChangePct.toFixed(1)}%`
        );
      } else {
        votes.push(0);
        reasons.push(`Proyeksi tren ${HORIZON} hari ke depan relatif datar`);
      }
    }
  } else {
    // Fast proxy for backtest: SMA20 slope over 5 bars instead of full Holt
    if (i >= 5 && sma20[i] != null && sma20[i - 5] != null && price > 0) {
      const slopePct = ((sma20[i] - sma20[i - 5]) / price) * 100;
      if (slopePct > 0.8) {
        score += w.holt * 0.85;
        votes.push(1);
      } else if (slopePct < -0.8) {
        score -= w.holt * 0.85;
        votes.push(-1);
      } else {
        votes.push(0);
      }
    }
  }

  // 5. Bollinger (mean reversion) — stronger in sideways
  const pctB = bb.percentB[i];
  if (pctB != null && bb.upper[i] != null && bb.lower[i] != null) {
    if (price < bb.lower[i] || pctB < 0) {
      score += w.bb;
      votes.push(1);
      if (includeForecast)
        reasons.push(
          `Harga di bawah Bollinger bawah (%B ${pctB.toFixed(2)} — oversold band)`
        );
    } else if (price > bb.upper[i] || pctB > 1) {
      score -= w.bb;
      votes.push(-1);
      if (includeForecast)
        reasons.push(
          `Harga di atas Bollinger atas (%B ${pctB.toFixed(2)} — overbought band)`
        );
    } else if (pctB <= 0.2) {
      score += w.bb * 0.45;
      votes.push(1);
      if (includeForecast)
        reasons.push(`Harga dekat Bollinger bawah (%B ${pctB.toFixed(2)})`);
    } else if (pctB >= 0.8) {
      score -= w.bb * 0.45;
      votes.push(-1);
      if (includeForecast)
        reasons.push(`Harga dekat Bollinger atas (%B ${pctB.toFixed(2)})`);
    } else {
      votes.push(0);
      if (includeForecast)
        reasons.push(`Bollinger %B ${pctB.toFixed(2)} (di dalam pita, netral)`);
    }
  }

  // 6. Relative strength vs market index (optional)
  if (relCloses && indexSma20 && relCloses[i] != null && indexSma20[i] != null) {
    if (relCloses[i] > indexSma20[i]) {
      score += w.rs;
      votes.push(1);
      if (includeForecast)
        reasons.push("Relative strength di atas rata-rata vs indeks pasar");
    } else {
      score -= w.rs;
      votes.push(-1);
      if (includeForecast)
        reasons.push("Relative strength di bawah rata-rata vs indeks pasar");
    }
  }

  if (includeForecast) {
    const regimeLabel =
      regime === "trending"
        ? "tren"
        : regime === "sideways"
        ? "sideways / choppy"
        : "campuran";
    reasons.unshift(
      `Rezim ${regimeLabel}` +
        (trendStrength != null ? ` (kekuatan tren ${trendStrength.toFixed(2)}×ATR)` : "")
    );
  }

  const threshold =
    atrPct != null && atrPct > 0.045 ? CHOPPY_THRESHOLD : ACTION_THRESHOLD;

  let action = "HOLD";
  if (score >= threshold) action = "BUY";
  else if (score <= -threshold) action = "SELL";

  // Volume filter: weak volume → don't act on BUY/SELL
  const volRatio =
    volSma20[i] != null && volSma20[i] > 0 && vol[i] != null
      ? vol[i] / volSma20[i]
      : null;
  let volumeOk = true;
  if (action !== "HOLD" && volRatio != null && volRatio < VOLUME_MIN_RATIO) {
    volumeOk = false;
    action = "HOLD";
    if (includeForecast) {
      reasons.push(
        `Volume lemah (${(volRatio * 100).toFixed(0)}% dari rata-rata 20h) — sinyal ditahan`
      );
    }
  } else if (includeForecast && volRatio != null) {
    reasons.push(`Volume ${(volRatio * 100).toFixed(0)}% dari rata-rata 20h`);
  }

  // ATR chop note
  if (includeForecast && atrPct != null && atrPct > 0.045) {
    reasons.push(
      `Volatilitas tinggi (ATR ${(atrPct * 100).toFixed(1)}%) — ambang sinyal diperketat`
    );
  }

  const signed = votes.filter((v) => v !== 0);
  const bull = signed.filter((v) => v > 0).length;
  const bear = signed.filter((v) => v < 0).length;
  const agreement =
    signed.length === 0 ? 0 : Math.max(bull, bear) / signed.length;
  // Confidence blends agreement with how far score is past threshold
  const strength = Math.min(1, Math.abs(score) / (threshold + 1.5));
  const confidence = Number((0.55 * agreement + 0.45 * strength).toFixed(3));

  return {
    action,
    score: Number(score.toFixed(2)),
    reasons,
    regime,
    trendStrength: trendStrength != null ? Number(trendStrength.toFixed(3)) : null,
    atrPct: atrPct != null ? Number(atrPct.toFixed(4)) : null,
    volRatio: volRatio != null ? Number(volRatio.toFixed(3)) : null,
    volumeOk,
    threshold,
    confidence,
    agreement: Number(agreement.toFixed(3)),
    votes: { bull, bear, neutral: votes.length - signed.length },
    indicators: {
      sma20: sma20[i],
      sma50: sma50[i],
      rsi14: rsi14[i],
      macdHist: hist[i],
      bbUpper: bb.upper[i],
      bbMiddle: bb.middle[i],
      bbLower: bb.lower[i],
      bbPercentB: pctB,
      atr14: atr14[i],
    },
    forecast,
    projectedChangePct,
  };
}

/**
 * Combine trend + momentum + mean-reversion into BUY/SELL/HOLD.
 * Accepts OHLC + volume (+ optional index closes for relative strength).
 */
function buildSignal({ closes, highs, lows, volumes, indexCloses }) {
  if (!closes || closes.length < 30) {
    return {
      action: "HOLD",
      score: 0,
      reasons: ["Data historis kurang untuk sinyal andal"],
      confidence: 0,
      regime: "mixed",
      indicators: {},
      forecast: [],
      projectedChangePct: null,
    };
  }

  const series = computeSeries({ closes, highs, lows, volumes, indexCloses });
  const last = closes.length - 1;
  return scoreAt(series, closes, last, { includeForecast: true });
}

/**
 * Walk-forward hit-rate for BUY/SELL signals on this ticker's history.
 * A BUY is a hit if close[i+horizon] > close[i]; SELL if lower.
 */
function backtestSignal(
  { closes, highs, lows, volumes, indexCloses },
  { horizon = HORIZON, minBars = 60 } = {}
) {
  const n = closes?.length || 0;
  if (n < minBars + horizon + 5) {
    return {
      horizon,
      samples: 0,
      hits: 0,
      hitRate: null,
      buySamples: 0,
      buyHits: 0,
      buyHitRate: null,
      sellSamples: 0,
      sellHits: 0,
      sellHitRate: null,
      holdShare: null,
      note: "Histori terlalu pendek untuk backtest sinyal",
    };
  }

  const series = computeSeries({ closes, highs, lows, volumes, indexCloses });
  let samples = 0;
  let hits = 0;
  let buySamples = 0;
  let buyHits = 0;
  let sellSamples = 0;
  let sellHits = 0;
  let holds = 0;
  let scored = 0;

  const start = Math.max(minBars, 55);
  const end = n - horizon;

  for (let i = start; i < end; i++) {
    const { action } = scoreAt(series, closes, i, { includeForecast: false });
    scored += 1;
    if (action === "HOLD") {
      holds += 1;
      continue;
    }

    const future = closes[i + horizon];
    const now = closes[i];
    if (now == null || future == null || now <= 0) continue;

    const up = future > now;
    samples += 1;
    if (action === "BUY") {
      buySamples += 1;
      if (up) {
        hits += 1;
        buyHits += 1;
      }
    } else if (action === "SELL") {
      sellSamples += 1;
      if (!up) {
        hits += 1;
        sellHits += 1;
      }
    }
  }

  const rate = (h, s) => (s > 0 ? Number((h / s).toFixed(4)) : null);

  return {
    horizon,
    samples,
    hits,
    hitRate: rate(hits, samples),
    buySamples,
    buyHits,
    buyHitRate: rate(buyHits, buySamples),
    sellSamples,
    sellHits,
    sellHitRate: rate(sellHits, sellSamples),
    holdShare: scored > 0 ? Number((holds / scored).toFixed(4)) : null,
    barsScored: scored,
    note:
      samples < 8
        ? "Sedikit sampel BUY/SELL — hit-rate kurang andal"
        : "Hit-rate arah harga setelah horizon pada sinyal historis (bukan jaminan ke depan)",
  };
}

module.exports = {
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  atr,
  holtForecast,
  buildSignal,
  backtestSignal,
  ACTION_THRESHOLD,
  HORIZON,
};
