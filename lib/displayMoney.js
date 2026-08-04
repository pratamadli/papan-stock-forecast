// Client-side display helpers: convert USD-native prices to IDR via FX spot.
// Native journal/storage stays in the asset's currency (USD for crypto/US).

export function scaleSeries(values, factor) {
  if (!values || factor === 1) return values;
  return values.map((v) => (v == null ? null : v * factor));
}

/**
 * Build a display view of API stock payload in USD or IDR.
 * IDX (already IDR) ignores the toggle.
 */
export function buildDisplayView(data, displayCurrency) {
  if (!data) {
    return {
      currency: "USD",
      factor: 1,
      fxNote: null,
      closes: null,
      sma20: null,
      sma50: null,
      forecast: null,
      price: null,
      signal: null,
      fundamental: null,
    };
  }

  const native = data.currency || "USD";
  const usdIdr = data.fx?.usdIdr;
  const wantIdr = displayCurrency === "IDR";

  // IDX is already Rupiah — no FX needed.
  if (native === "IDR") {
    return {
      currency: "IDR",
      factor: 1,
      fxNote: null,
      closes: data.closes,
      sma20: data.sma20,
      sma50: data.sma50,
      forecast: data.signal?.forecast,
      price: data.closes?.[data.closes.length - 1] ?? null,
      signal: data.signal,
      fundamental: data.fundamental,
    };
  }

  const canConvert = wantIdr && typeof usdIdr === "number" && usdIdr > 0;
  const factor = canConvert ? usdIdr : 1;
  const currency = canConvert ? "IDR" : "USD";

  const forecast = scaleSeries(data.signal?.forecast, factor);
  const indicators = data.signal?.indicators
    ? {
        ...data.signal.indicators,
        sma20: scaleNum(data.signal.indicators.sma20, factor),
        sma50: scaleNum(data.signal.indicators.sma50, factor),
        macdHist: scaleNum(data.signal.indicators.macdHist, factor),
        bbUpper: scaleNum(data.signal.indicators.bbUpper, factor),
        bbMiddle: scaleNum(data.signal.indicators.bbMiddle, factor),
        bbLower: scaleNum(data.signal.indicators.bbLower, factor),
        atr14: scaleNum(data.signal.indicators.atr14, factor),
        // rsi / %B stay unitless
      }
    : null;

  let fundamental = data.fundamental;
  if (fundamental && factor !== 1) {
    fundamental = {
      ...fundamental,
      intrinsicValueNow: scaleNum(fundamental.intrinsicValueNow, factor),
      projectedByYear: (fundamental.projectedByYear || []).map((p) => ({
        ...p,
        price: scaleNum(p.price, factor),
        fairValueNow: scaleNum(p.fairValueNow, factor),
      })),
    };
  }

  return {
    currency,
    factor,
    fxNote: canConvert
      ? `Kurs Yahoo USD/IDR ≈ Rp ${Math.round(usdIdr).toLocaleString("id-ID")} (tampilkan konversi; data asli USD)`
      : wantIdr
      ? "Kurs USD/IDR belum tersedia — menampilkan USD"
      : null,
    closes: scaleSeries(data.closes, factor),
    sma20: scaleSeries(data.sma20, factor),
    sma50: scaleSeries(data.sma50, factor),
    forecast,
    price: scaleNum(data.closes?.[data.closes.length - 1], factor),
    signal: data.signal
      ? {
          ...data.signal,
          forecast,
          indicators,
        }
      : null,
    fundamental,
  };
}

function scaleNum(n, factor) {
  if (n == null || Number.isNaN(n)) return n;
  return n * factor;
}
