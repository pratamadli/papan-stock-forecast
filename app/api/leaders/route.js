import { NextResponse } from "next/server";
import universe from "../../../data/signal-universe.json";
import { fetchHistory } from "../../../lib/yahoo";
import { buildSignal } from "../../../lib/forecast";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = new Set(["IDX", "US", "CRYPTO"]);
const CACHE_TTL_MS = 15 * 60 * 1000;
const BATCH = 4;
const TOP_N = 10;

/** @type {Map<string, { at: number, payload: object }>} */
const cache = new Map();

function displaySymbol(symbol, market) {
  if (market === "IDX") return String(symbol).replace(/\.JK$/i, "");
  if (market === "CRYPTO") return String(symbol).replace(/-USD$/i, "");
  return symbol;
}

function indexTickerFor(market) {
  if (market === "IDX") return "^JKSE";
  if (market === "CRYPTO") return "BTC-USD";
  return "SPY";
}

async function fetchBenchmarkCloses(market, range) {
  try {
    const bench = indexTickerFor(market);
    const benchMarket = market === "CRYPTO" ? "CRYPTO" : "US";
    const history = await fetchHistory(bench, benchMarket, range);
    return history.closes;
  } catch {
    return undefined;
  }
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return out;
}

function rankLeaders(rows) {
  const buy = rows
    .filter((r) => r.action === "BUY")
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);
  const sell = rows
    .filter((r) => r.action === "SELL")
    .sort((a, b) => a.score - b.score)
    .slice(0, TOP_N);
  const hold = rows
    .filter((r) => r.action === "HOLD")
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, TOP_N);
  return { buy, sell, hold };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const marketRaw = (searchParams.get("market") || "IDX").toUpperCase();
  const market = ALLOWED.has(marketRaw) ? marketRaw : "IDX";
  const range = searchParams.get("range") || "6mo";
  const force = searchParams.get("refresh") === "1";

  const cacheKey = `${market}|${range}`;
  const hit = cache.get(cacheKey);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true });
  }

  const symbols = universe[market] || [];
  if (symbols.length === 0) {
    return NextResponse.json(
      { error: `Universe kosong untuk market ${market}` },
      { status: 500 }
    );
  }

  try {
    const indexCloses = await fetchBenchmarkCloses(market, range);

    const scored = await mapPool(symbols, BATCH, async (raw) => {
      try {
        const history = await fetchHistory(raw, market, range);
        if (!history.closes || history.closes.length < 30) return null;

        const signal = buildSignal({
          closes: history.closes,
          highs: history.highs,
          lows: history.lows,
          volumes: history.volumes,
          indexCloses,
        });

        const price = history.closes[history.closes.length - 1];
        return {
          symbol: displaySymbol(history.symbol, market),
          yahooSymbol: history.symbol,
          name: history.longName,
          action: signal.action,
          score: signal.score,
          confidence: signal.confidence ?? null,
          regime: signal.regime ?? null,
          threshold: signal.threshold ?? null,
          price,
          currency: history.currency,
        };
      } catch {
        return null;
      }
    });

    const rows = scored.filter(Boolean);
    const { buy, sell, hold } = rankLeaders(rows);

    const payload = {
      market,
      range,
      asOf: new Date().toISOString(),
      universeSize: symbols.length,
      scanned: rows.length,
      buy,
      sell,
      hold,
      cached: false,
    };

    cache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal memuat leaderboard sinyal" },
      { status: 502 }
    );
  }
}
