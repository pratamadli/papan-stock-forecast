// Core forecasting & technical-analysis logic.
// Everything here is plain JS math — no external ML service required,
// so it runs fine in a Vercel serverless function or the browser.

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
 * Holt's linear trend method (double exponential smoothing).
 * Produces a level + trend forecast for the next `horizon` days.
 * alpha = weight on level, beta = weight on trend.
 */
function holtForecast(values, horizon = 10, alpha = 0.3, beta = 0.15) {
  if (values.length < 2) return { fitted: [], forecast: [] };
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

/**
 * Combine trend + momentum + mean-reversion signals into one
 * buy/sell/hold recommendation with a human-readable rationale.
 */
function buildSignal({ closes }) {
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsi14 = rsi(closes, 14);
  const { macdLine, signal: macdSignal, hist } = macd(closes);
  const { forecast, trend } = holtForecast(closes, 10);

  const last = closes.length - 1;
  const price = closes[last];
  const reasons = [];
  let score = 0; // positive = bullish, negative = bearish

  // 1. Moving average crossover (trend-following)
  if (sma20[last] != null && sma50[last] != null) {
    if (sma20[last] > sma50[last]) {
      score += 1;
      reasons.push("SMA20 di atas SMA50 (tren jangka pendek naik)");
    } else {
      score -= 1;
      reasons.push("SMA20 di bawah SMA50 (tren jangka pendek turun)");
    }
  }

  // 2. RSI (mean reversion)
  if (rsi14[last] != null) {
    if (rsi14[last] < 30) {
      score += 1.2;
      reasons.push(`RSI ${rsi14[last].toFixed(1)} (oversold, berpotensi rebound)`);
    } else if (rsi14[last] > 70) {
      score -= 1.2;
      reasons.push(`RSI ${rsi14[last].toFixed(1)} (overbought, rawan koreksi)`);
    } else {
      reasons.push(`RSI ${rsi14[last].toFixed(1)} (netral)`);
    }
  }

  // 3. MACD momentum
  if (hist[last] != null && hist[last - 1] != null) {
    if (hist[last] > 0 && hist[last - 1] <= 0) {
      score += 1.3;
      reasons.push("MACD baru saja golden cross (momentum berbalik naik)");
    } else if (hist[last] < 0 && hist[last - 1] >= 0) {
      score -= 1.3;
      reasons.push("MACD baru saja death cross (momentum berbalik turun)");
    } else if (hist[last] > 0) {
      score += 0.4;
      reasons.push("Histogram MACD positif (momentum naik berlanjut)");
    } else {
      score -= 0.4;
      reasons.push("Histogram MACD negatif (momentum turun berlanjut)");
    }
  }

  // 4. Holt trend forecast direction over next 10 days
  const projectedChangePct = ((forecast[forecast.length - 1] - price) / price) * 100;
  if (projectedChangePct > 1) {
    score += 1;
    reasons.push(
      `Proyeksi tren 10 hari ke depan naik ~${projectedChangePct.toFixed(1)}%`
    );
  } else if (projectedChangePct < -1) {
    score -= 1;
    reasons.push(
      `Proyeksi tren 10 hari ke depan turun ~${projectedChangePct.toFixed(1)}%`
    );
  } else {
    reasons.push("Proyeksi tren 10 hari ke depan relatif datar");
  }

  let action = "HOLD";
  if (score >= 1.5) action = "BUY";
  else if (score <= -1.5) action = "SELL";

  return {
    action,
    score: Number(score.toFixed(2)),
    reasons,
    indicators: {
      sma20: sma20[last],
      sma50: sma50[last],
      rsi14: rsi14[last],
      macdHist: hist[last],
    },
    forecast,
    projectedChangePct,
  };
}

module.exports = { sma, ema, rsi, macd, holtForecast, buildSignal };
