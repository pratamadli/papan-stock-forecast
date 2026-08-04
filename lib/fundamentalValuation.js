// Fundamental valuation: open, standard concepts (CAGR extrapolation,
// Graham-style Margin of Safety) — NOT a copy of any paid/proprietary
// method. Meant as a value-investing complement to the technical signal
// in lib/forecast.js, so a buy/sell decision considers the underlying
// business, not just price patterns.

/** CAGR between the first and last value in a series, given n periods between them. */
function cagr(startValue, endValue, periods) {
  if (startValue == null || endValue == null || periods <= 0) return null;
  if (startValue <= 0 || endValue <= 0) return null; // CAGR undefined for negative/zero base
  return Math.pow(endValue / startValue, 1 / periods) - 1;
}

/**
 * @param {object} input
 * @param {number} input.currentPrice
 * @param {number|null} input.trailingEps
 * @param {number|null} input.trailingPE
 * @param {number|null} input.dividendYield  fraction, e.g. 0.03
 * @param {Array<{year:number, revenue:number|null, earnings:number|null}>} input.yearlyEarnings
 *        oldest → newest, typically ~4 years from Yahoo's earnings module
 * @param {number[]} input.priceHistory closes, oldest → newest (from the main OHLC fetch)
 * @param {number} [input.years=5] projection horizon
 * @param {number} [input.discountRate=0.15] required annual return used to discount the
 *        projected future price back to a present "intrinsic value" — 15% is a common
 *        conservative default in Graham-style margin-of-safety analysis, not derived from
 *        this specific ticker.
 */
function computeFundamentalValuation({
  currentPrice,
  trailingEps,
  trailingPE,
  dividendYield,
  yearlyEarnings = [],
  priceHistory = [],
  years = 5,
  discountRate = 0.15,
}) {
  if (!currentPrice) return null;

  // 1. Growth rate: prefer earnings CAGR; fall back to revenue CAGR if
  // earnings are negative/zero/unavailable (common for growth-stage
  // companies where earnings are noisy but revenue isn't).
  let growthBasis = null;
  let growthRate = null;

  const validEarnings = yearlyEarnings.filter((y) => y.earnings != null);
  if (validEarnings.length >= 2) {
    const first = validEarnings[0];
    const last = validEarnings[validEarnings.length - 1];
    const periods = validEarnings.length - 1;
    const rate = cagr(first.earnings, last.earnings, periods);
    if (rate != null) {
      growthBasis = "earnings";
      growthRate = rate;
    }
  }
  if (growthRate == null) {
    const validRevenue = yearlyEarnings.filter((y) => y.revenue != null);
    if (validRevenue.length >= 2) {
      const first = validRevenue[0];
      const last = validRevenue[validRevenue.length - 1];
      const periods = validRevenue.length - 1;
      const rate = cagr(first.revenue, last.revenue, periods);
      if (rate != null) {
        growthBasis = "revenue";
        growthRate = rate;
      }
    }
  }

  // 2. Price-based CAGR, independent check using the price history we
  // already have from the main OHLC fetch (roughly matches the 'range'
  // the user picked, e.g. 6mo/1y/2y — so treat as short-horizon context,
  // not a substitute for multi-year fundamental growth).
  let priceCagr = null;
  if (priceHistory.length > 20) {
    const tradingDaysPerYear = 252;
    const periodsInYears = priceHistory.length / tradingDaysPerYear;
    priceCagr = cagr(priceHistory[0], priceHistory[priceHistory.length - 1], periodsInYears);
  }

  // Clamp growth rate to something sane — hyper-extrapolating a noisy
  // 3-4 year CAGR out 5+ years compounds errors fast.
  const clampedGrowth =
    growthRate != null ? Math.max(-0.3, Math.min(growthRate, 0.6)) : null;

  // 3. Project EPS forward at the growth rate, then apply the stock's
  // OWN current P/E as the assumed future multiple (simple, transparent
  // assumption: "the market keeps valuing this business the way it does
  // today" — conservative vs assuming multiple expansion).
  // Per year we also discount that future price back to today's "harga
  // wajar" for that horizon, so the UI can show fair value across the
  // full projection range — not only at the final year.
  let projectedByYear = [];
  let futurePriceAtHorizon = null;

  if (trailingEps != null && trailingEps > 0 && trailingPE != null && clampedGrowth != null) {
    for (let y = 1; y <= years; y++) {
      const futureEps = trailingEps * Math.pow(1 + clampedGrowth, y);
      const futurePrice = futureEps * trailingPE;
      const fairValueNow = futurePrice / Math.pow(1 + discountRate, y);
      const gapPct = (fairValueNow - currentPrice) / fairValueNow;
      let keterangan;
      if (gapPct > 0.1) {
        keterangan = `Harga pasar di bawah harga wajar horizon ${y} th (~${(gapPct * 100).toFixed(0)}% lebih murah)`;
      } else if (gapPct < -0.1) {
        keterangan = `Harga pasar di atas harga wajar horizon ${y} th (~${(Math.abs(gapPct) * 100).toFixed(0)}% lebih mahal)`;
      } else {
        keterangan = `Harga pasar relatif dekat harga wajar horizon ${y} th`;
      }
      projectedByYear.push({
        year: y,
        price: futurePrice,
        fairValueNow,
        gapPct,
        keterangan,
      });
    }
    futurePriceAtHorizon = projectedByYear[projectedByYear.length - 1]?.price ?? null;
  }

  // 4. Intrinsic value now = discount the projected future price back
  // at the required rate of return, then Margin of Safety = how much
  // cheaper today's price is than that intrinsic value.
  let intrinsicValueNow = null;
  let marginOfSafety = null;
  if (futurePriceAtHorizon != null) {
    intrinsicValueNow = futurePriceAtHorizon / Math.pow(1 + discountRate, years);
    marginOfSafety = (intrinsicValueNow - currentPrice) / intrinsicValueNow;
  }

  let fairValueNote = null;
  if (intrinsicValueNow != null) {
    if (marginOfSafety > 0.1) {
      fairValueNote = `Harga wajar model ~di atas harga pasar (Margin of Safety positif) selama rentang proyeksi ${years} tahun.`;
    } else if (marginOfSafety < -0.1) {
      fairValueNote = `Harga wajar model ~di bawah harga pasar (saham terlihat mahal) selama rentang proyeksi ${years} tahun.`;
    } else {
      fairValueNote = `Harga pasar relatif dekat harga wajar model selama rentang proyeksi ${years} tahun.`;
    }
  }

  return {
    growthBasis, // "earnings" | "revenue" | null
    growthRate: clampedGrowth,
    priceCagr,
    dividendYield,
    trailingPE,
    currentPrice,
    projectedByYear, // [{year, price, fairValueNow, gapPct, keterangan}]
    futurePriceAtHorizon,
    intrinsicValueNow,
    marginOfSafety, // fraction; >0 means currently "undervalued" by this model
    fairValueNote,
    years,
    discountRate,
    dataQuality:
      clampedGrowth == null
        ? "insufficient"
        : validEarnings.length < 3
        ? "limited"
        : "ok",
  };
}

module.exports = { computeFundamentalValuation, cagr };
