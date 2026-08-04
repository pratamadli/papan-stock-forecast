// Thin wrapper around Yahoo Finance's public (unauthenticated) endpoints.
// No API key needed. Covers both US tickers (e.g. AAPL) and Indonesian
// tickers on the IDX, which Yahoo lists with a ".JK" suffix (e.g. BBCA.JK).

const CHART_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function normalizeSymbol(rawSymbol, market) {
  let symbol = rawSymbol.trim().toUpperCase();
  if (market === "IDX" && !symbol.endsWith(".JK")) {
    symbol = `${symbol}.JK`;
  }
  return symbol;
}

async function fetchWithFallback(pathAndQuery) {
  let lastError;
  for (const host of CHART_HOSTS) {
    try {
      const res = await fetch(`https://${host}${pathAndQuery}`, {
        headers: { "User-Agent": UA },
        cache: "no-store",
      });
      if (!res.ok) {
        lastError = new Error(`Yahoo Finance responded ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Gagal menghubungi Yahoo Finance");
}

/**
 * Fetch daily OHLC history for a symbol.
 * @param {string} rawSymbol e.g. "BBCA" or "AAPL"
 * @param {"IDX"|"US"} market
 * @param {string} range e.g. "1y", "6mo", "2y"
 */
async function fetchHistory(rawSymbol, market, range = "1y") {
  const symbol = normalizeSymbol(rawSymbol, market);
  const query = `/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=1d&includePrePost=false`;
  const data = await fetchWithFallback(query);

  const result = data?.chart?.result?.[0];
  if (!result) {
    const errDesc = data?.chart?.error?.description;
    throw new Error(errDesc || `Ticker "${symbol}" tidak ditemukan`);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closesRaw = quote.close || [];

  const dates = [];
  const closes = [];
  const opens = [];
  const highs = [];
  const lows = [];
  const volumes = [];

  for (let i = 0; i < timestamps.length; i++) {
    if (closesRaw[i] == null) continue; // skip non-trading gaps
    dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
    closes.push(closesRaw[i]);
    opens.push(quote.open?.[i] ?? closesRaw[i]);
    highs.push(quote.high?.[i] ?? closesRaw[i]);
    lows.push(quote.low?.[i] ?? closesRaw[i]);
    volumes.push(quote.volume?.[i] ?? 0);
  }

  const meta = result.meta || {};

  return {
    symbol,
    // Always follow selected market: IDX = Rupiah, US = USD
    currency: market === "IDX" ? "IDR" : "USD",
    longName: meta.longName || meta.shortName || symbol,
    exchangeName: meta.exchangeName,
    dates,
    opens,
    highs,
    lows,
    closes,
    volumes,
  };
}

/** Look up ticker symbols by company name or partial ticker. */
async function searchSymbol(query) {
  const path = `/v1/finance/search?q=${encodeURIComponent(
    query
  )}&quotesCount=8&newsCount=0`;
  const data = await fetchWithFallback(path);
  const quotes = data?.quotes || [];
  return quotes
    .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.isYahooFinance))
    .map((q) => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      exchange: q.exchange,
    }));
}

/**
 * Fetch fundamental data: trailing P/E, dividend yield, EPS, and a few
 * years of revenue/earnings history (for CAGR calculation). Not all
 * tickers have every field — missing values come back as null and the
 * caller (lib/fundamentalValuation.js) degrades gracefully.
 */
async function fetchFundamentals(rawSymbol, market) {
  const symbol = normalizeSymbol(rawSymbol, market);
  const modules = "summaryDetail,defaultKeyStatistics,financialData,earnings";
  const query = `/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const data = await fetchWithFallback(query);

  const result = data?.quoteSummary?.result?.[0];
  if (!result) {
    const errDesc = data?.quoteSummary?.error?.description;
    throw new Error(errDesc || `Data fundamental untuk "${symbol}" tidak tersedia`);
  }

  const raw = (obj) => (obj && typeof obj.raw === "number" ? obj.raw : null);

  const summaryDetail = result.summaryDetail || {};
  const keyStats = result.defaultKeyStatistics || {};
  const financialData = result.financialData || {};
  const yearlyChart = result.earnings?.financialsChart?.yearly || [];

  const yearlyEarnings = yearlyChart.map((y) => ({
    year: y.date,
    revenue: raw(y.revenue),
    earnings: raw(y.earnings),
  }));

  return {
    symbol,
    currentPrice: raw(financialData.currentPrice) ?? raw(summaryDetail.previousClose),
    trailingPE: raw(summaryDetail.trailingPE),
    forwardPE: raw(summaryDetail.forwardPE),
    dividendYield: raw(summaryDetail.dividendYield), // fraction, e.g. 0.03 = 3%
    trailingEps: raw(keyStats.trailingEps),
    forwardEps: raw(keyStats.forwardEps),
    revenueGrowth: raw(financialData.revenueGrowth), // fraction, YoY
    earningsGrowth: raw(financialData.earningsGrowth), // fraction, YoY
    yearlyEarnings,
  };
}

module.exports = { fetchHistory, fetchFundamentals, searchSymbol, normalizeSymbol };
