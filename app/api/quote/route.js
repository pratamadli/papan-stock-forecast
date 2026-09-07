import { NextResponse } from "next/server";
import { fetchHistory } from "../../../lib/yahoo";
import { buildSignal } from "../../../lib/forecast";
import { checkSyariahStatus } from "../../../lib/syariah";

export const runtime = "nodejs";

const ALLOWED_MARKETS = new Set(["IDX", "US", "CRYPTO"]);
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 250;

/** @type {Map<string, { at: number, payload: object }>} */
const cache = new Map();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const marketRaw = (searchParams.get("market") || "US").toUpperCase();
  const market = ALLOWED_MARKETS.has(marketRaw) ? marketRaw : "US";
  const range = searchParams.get("range") || "6mo";

  if (!symbol) {
    return NextResponse.json({ error: "Parameter symbol wajib diisi" }, { status: 400 });
  }

  const cacheKey = `${symbol.trim().toUpperCase()}|${market}|${range}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...hit.payload, cached: true });
  }

  try {
    const history = await fetchHistory(symbol, market, range);

    if (history.closes.length < 30) {
      return NextResponse.json(
        {
          error:
            "Data historis terlalu sedikit untuk memuat harga posisi (minimal ~30 hari perdagangan).",
        },
        { status: 422 }
      );
    }

    const signal = buildSignal({
      closes: history.closes,
      highs: history.highs,
      lows: history.lows,
      volumes: history.volumes,
    });

    const payload = {
      symbol: history.symbol,
      market,
      price: history.closes[history.closes.length - 1],
      currency: history.currency,
      signal,
      syariah: checkSyariahStatus(history.symbol, market),
      asOf: new Date().toISOString(),
      cached: false,
    };

    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(cacheKey, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal memuat harga posisi" },
      { status: 502 }
    );
  }
}
