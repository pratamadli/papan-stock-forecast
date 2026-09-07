// Thin wrapper around Yahoo Finance's public (unauthenticated) endpoints.
// No API key needed. Covers US equities, IDX (.JK), and crypto (*-USD).

const CHART_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;
const FETCH_TIMEOUT_MS = 4500;
const RESPONSE_CACHE_TTL_MS = 60 * 1000;
const RESPONSE_CACHE_MAX = 250;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** @type {Map<string, { at: number, data: object }>} */
const responseCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rememberResponse(key, data) {
  if (responseCache.size >= RESPONSE_CACHE_MAX) {
    responseCache.clear();
  }
  responseCache.set(key, { at: Date.now(), data });
}

async function fetchJsonOnce(host, pathAndQuery) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`https://${host}${pathAndQuery}`, {
      headers: { "User-Agent": UA },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Yahoo Finance responded ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Yahoo Finance timeout after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Try the primary host up to MAX_ATTEMPTS times (first call + 2 retries).
 * If all three fail, fall back to the remaining hosts once each.
 */
async function fetchWithFallback(pathAndQuery) {
  const cached = responseCache.get(pathAndQuery);
  if (cached && Date.now() - cached.at < RESPONSE_CACHE_TTL_MS) {
    return cached.data;
  }

  const [primary, ...fallbacks] = CHART_HOSTS;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await fetchJsonOnce(primary, pathAndQuery);
      rememberResponse(pathAndQuery, data);
      return data;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  for (const host of fallbacks) {
    try {
      const data = await fetchJsonOnce(host, pathAndQuery);
      rememberResponse(pathAndQuery, data);
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Gagal menghubungi Yahoo Finance");
}

/**
 * @param {string} rawSymbol e.g. "BBCA", "AAPL", "BTC", "BTC-USD"
 * @param {"IDX"|"US"|"CRYPTO"} market
 */
function normalizeSymbol(rawSymbol, market) {
  let symbol = rawSymbol.trim().toUpperCase().replace(/\s+/g, "");

  if (market === "IDX") {
    if (!symbol.endsWith(".JK")) symbol = `${symbol}.JK`;
    return symbol;
  }

  if (market === "CRYPTO") {
    // BTCUSD / ETHUSDT-style → BTC-USD (Yahoo uses *-USD pairs)
    if (/^[A-Z0-9]+USDT$/.test(symbol)) {
      symbol = symbol.replace(/USDT$/, "") + "-USD";
    } else if (/^[A-Z0-9]+USD$/.test(symbol) && !symbol.includes("-")) {
      symbol = symbol.replace(/USD$/, "") + "-USD";
    } else if (!symbol.includes("-") && !symbol.startsWith("^")) {
      symbol = `${symbol}-USD`;
    }
    return symbol;
  }

  // US equities — leave as typed (AAPL, MSFT, …)
  return symbol;
}

function currencyForMarket(market) {
  return market === "IDX" ? "IDR" : "USD";
}

/**
 * Fetch daily OHLC history for a symbol.
 * @param {string} rawSymbol e.g. "BBCA", "AAPL", "BTC"
 * @param {"IDX"|"US"|"CRYPTO"} market
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
    if (closesRaw[i] == null) continue; // skip gaps
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
    currency: currencyForMarket(market),
    market,
    longName: meta.longName || meta.shortName || symbol,
    exchangeName: meta.exchangeName || (market === "CRYPTO" ? "CRYPTO" : meta.exchangeName),
    dates,
    opens,
    highs,
    lows,
    closes,
    volumes,
  };
}

/**
 * Look up ticker symbols by name or partial ticker.
 * @param {string} query
 * @param {"IDX"|"US"|"CRYPTO"|null} [market] optional filter
 */
async function searchSymbol(query, market = null) {
  const path = `/v1/finance/search?q=${encodeURIComponent(
    query
  )}&quotesCount=12&newsCount=0`;
  const data = await fetchWithFallback(path);
  const quotes = data?.quotes || [];

  let filtered = quotes.filter((q) => q.symbol);

  if (market === "CRYPTO") {
    filtered = filtered.filter(
      (q) =>
        q.quoteType === "CRYPTOCURRENCY" ||
        (/-USD$/i.test(q.symbol) &&
          (q.quoteType === "CRYPTOCURRENCY" ||
            /CRYPTO|CCC|Coin/i.test(String(q.exchange || q.exchDisp || ""))))
    );
    // If Yahoo returned nothing useful, still surface *-USD cryptocurrency hits loosely
    if (filtered.length === 0) {
      filtered = quotes.filter(
        (q) => q.symbol && (q.quoteType === "CRYPTOCURRENCY" || /-USD$/i.test(q.symbol))
      );
    }
  } else if (market === "IDX") {
    filtered = filtered.filter(
      (q) =>
        /\.JK$/i.test(q.symbol) ||
        /JKT|Jakarta|IDX/i.test(String(q.exchange || q.exchDisp || ""))
    );
  } else if (market === "US") {
    filtered = filtered.filter(
      (q) =>
        (q.quoteType === "EQUITY" || q.isYahooFinance) &&
        !/\.JK$/i.test(q.symbol) &&
        q.quoteType !== "CRYPTOCURRENCY"
    );
  } else {
    filtered = filtered.filter(
      (q) =>
        q.quoteType === "EQUITY" ||
        q.quoteType === "CRYPTOCURRENCY" ||
        q.isYahooFinance
    );
  }

  return filtered.slice(0, 8).map((q) => ({
    symbol: q.symbol,
    name: q.longname || q.shortname || q.symbol,
    exchange: q.exchange,
    quoteType: q.quoteType || null,
  }));
}

/**
 * Fetch fundamental data. Not meaningful for CRYPTO — caller should skip.
 */
async function fetchFundamentals(rawSymbol, market) {
  if (market === "CRYPTO") {
    throw new Error("Valuasi fundamental tidak berlaku untuk crypto");
  }

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
    dividendYield: raw(summaryDetail.dividendYield),
    trailingEps: raw(keyStats.trailingEps),
    forwardEps: raw(keyStats.forwardEps),
    revenueGrowth: raw(financialData.revenueGrowth),
    earningsGrowth: raw(financialData.earningsGrowth),
    yearlyEarnings,
  };
}

/**
 * Spot USD→IDR rate from Yahoo forex (`IDR=X` / `USDIDR=X`).
 * Returns how many Rupiah per 1 USD, or null on failure.
 */
async function fetchUsdIdrRate() {
  for (const symbol of ["IDR=X", "USDIDR=X"]) {
    try {
      const query = `/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=5d&interval=1d`;
      const data = await fetchWithFallback(query);
      const result = data?.chart?.result?.[0];
      const meta = result?.meta || {};
      const closes = (result?.indicators?.quote?.[0]?.close || []).filter(
        (v) => v != null
      );
      const rate = meta.regularMarketPrice ?? closes[closes.length - 1];
      if (typeof rate === "number" && rate > 1000) {
        return {
          usdIdr: rate,
          symbol,
          asOf: new Date().toISOString(),
        };
      }
    } catch {
      // try next symbol
    }
  }
  return null;
}

module.exports = {
  fetchHistory,
  fetchFundamentals,
  searchSymbol,
  normalizeSymbol,
  currencyForMarket,
  fetchUsdIdrRate,
};

