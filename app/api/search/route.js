import { NextResponse } from "next/server";
import { searchSymbol } from "../../../lib/yahoo";

export const runtime = "nodejs";

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 100;

/** @type {Map<string, { at: number, results: object[] }>} */
const cache = new Map();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const marketRaw = (searchParams.get("market") || "").toUpperCase();
  const market = ["IDX", "US", "CRYPTO"].includes(marketRaw) ? marketRaw : null;

  if (!q || q.trim().length < 1) {
    return NextResponse.json({ results: [] });
  }

  const normalizedQ = q.trim();
  const cacheKey = `${normalizedQ.toUpperCase()}|${market || "ALL"}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ results: hit.results, cached: true });
  }

  try {
    const results = await searchSymbol(normalizedQ, market);
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(cacheKey, { at: Date.now(), results });
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ results: [], error: err.message }, { status: 200 });
  }
}
