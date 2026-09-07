import { NextResponse } from "next/server";
import { fetchHistory, fetchFundamentals, fetchUsdIdrRate } from "../../../lib/yahoo";
import { buildSignal, sma, backtestSignal } from "../../../lib/forecast";
import { fetchAdvancedSignal } from "../../../lib/localForecast";
import { computeFundamentalValuation } from "../../../lib/fundamentalValuation";
import { checkSyariahStatus } from "../../../lib/syariah";

export const runtime = "nodejs";

const ALLOWED_MARKETS = new Set(["IDX", "US", "CRYPTO"]);

/** Benchmark for relative strength — avoid comparing an asset to itself. */
function indexTickerFor(market, symbol = "") {
  if (market === "IDX") return "^JKSE";
  if (market === "CRYPTO") {
    const s = String(symbol).toUpperCase();
    return s.includes("BTC") ? "ETH-USD" : "BTC-USD";
  }
  return "SPY";
}

/**
 * Benchmark closes for relative strength.
 * Indexes/crypto pairs fetched with market that won't mangle the symbol:
 * ^JKSE/SPY → US; BTC-USD/ETH-USD → CRYPTO.
 */
async function fetchBenchmarkCloses(market, range, symbol) {
  try {
    const bench = indexTickerFor(market, symbol);
    const benchMarket =
      market === "CRYPTO" || bench.endsWith("-USD") ? "CRYPTO" : "US";
    const history = await fetchHistory(bench, benchMarket, range);
    return { closes: history.closes, symbol: bench };
  } catch {
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const marketRaw = (searchParams.get("market") || "US").toUpperCase();
  const market = ALLOWED_MARKETS.has(marketRaw) ? marketRaw : "US";
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

    const benchPromise = fetchBenchmarkCloses(market, range, history.symbol);
    const advancedPromise =
      market === "CRYPTO" ? Promise.resolve(null) : fetchAdvancedSignal(symbol, market);
    const fundamentalPromise =
      market === "CRYPTO"
        ? Promise.resolve(null)
        : fetchFundamentals(symbol, market)
            .then((rawFundamentals) =>
              computeFundamentalValuation({
                currentPrice:
                  rawFundamentals.currentPrice ??
                  history.closes[history.closes.length - 1],
                trailingEps: rawFundamentals.trailingEps,
                trailingPE: rawFundamentals.trailingPE,
                dividendYield: rawFundamentals.dividendYield,
                yearlyEarnings: rawFundamentals.yearlyEarnings,
                priceHistory: history.closes,
              })
            )
            .catch(() => null);
    const fxPromise =
      market === "CRYPTO" || market === "US"
        ? fetchUsdIdrRate().catch(() => null)
        : Promise.resolve(null);

    const bench = await benchPromise;

    const signalInput = {
      closes: history.closes,
      highs: history.highs,
      lows: history.lows,
      volumes: history.volumes,
      indexCloses: bench?.closes || undefined,
    };

    const signal = buildSignal(signalInput);
    const signalBacktest = backtestSignal(signalInput, { horizon: 10 });

    const sma20 = sma(history.closes, 20);
    const sma50 = sma(history.closes, 50);

    const syariah = checkSyariahStatus(symbol, market);
    const [advanced, fundamental, fx] = await Promise.all([
      advancedPromise,
      fundamentalPromise,
      fxPromise,
    ]);

    return NextResponse.json({
      ...history,
      market,
      sma20,
      sma50,
      signal: {
        ...signal,
        backtest: signalBacktest,
        benchmark: bench?.symbol || null,
      },
      advanced,
      fundamental,
      syariah,
      fx, // { usdIdr, symbol, asOf } | null
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data" },
      { status: 502 }
    );
  }
}
