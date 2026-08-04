import { NextResponse } from "next/server";
import { fetchHistory, fetchFundamentals } from "../../../lib/yahoo";
import { buildSignal, sma } from "../../../lib/forecast";
import { fetchAdvancedSignal } from "../../../lib/localForecast";
import { computeFundamentalValuation } from "../../../lib/fundamentalValuation";
import { checkSyariahStatus } from "../../../lib/syariah";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const market = (searchParams.get("market") || "US").toUpperCase();
  const range = searchParams.get("range") || "1y";

  if (!symbol) {
    return NextResponse.json({ error: "Parameter symbol wajib diisi" }, { status: 400 });
  }

  try {
    const history = await fetchHistory(symbol, market, range);

    if (history.closes.length < 30) {
      return NextResponse.json(
        {
          error:
            "Data historis terlalu sedikit untuk membuat forecast yang cukup andal (minimal ~30 hari perdagangan).",
        },
        { status: 422 }
      );
    }

    const signal = buildSignal({ closes: history.closes });
    const sma20 = sma(history.closes, 20);
    const sma50 = sma(history.closes, 50);

    // Best-effort: only present when the local Python service is running
    // (npm run dev + uvicorn on your machine). Silently null on Vercel.
    const advanced = await fetchAdvancedSignal(symbol, market);

    // Fundamental valuation — best-effort too. Some tickers (esp. IDX
    // small caps) don't have full fundamentals in Yahoo's quoteSummary,
    // so this degrades to null rather than failing the whole request.
    let fundamental = null;
    try {
      const rawFundamentals = await fetchFundamentals(symbol, market);
      fundamental = computeFundamentalValuation({
        currentPrice: rawFundamentals.currentPrice ?? history.closes[history.closes.length - 1],
        trailingEps: rawFundamentals.trailingEps,
        trailingPE: rawFundamentals.trailingPE,
        dividendYield: rawFundamentals.dividendYield,
        yearlyEarnings: rawFundamentals.yearlyEarnings,
        priceHistory: history.closes,
      });
    } catch {
      fundamental = null;
    }

    const syariah = checkSyariahStatus(symbol, market);

    return NextResponse.json({
      ...history,
      sma20,
      sma50,
      signal,
      advanced,
      fundamental,
      syariah,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data saham" },
      { status: 502 }
    );
  }
}
