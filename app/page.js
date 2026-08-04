"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import TickerTape from "../components/TickerTape";
import PriceChart from "../components/PriceChart";
import SignalBoard from "../components/SignalBoard";
import Watchlist from "../components/Watchlist";
import AdvancedSignal from "../components/AdvancedSignal";
import FundamentalPanel from "../components/FundamentalPanel";
import SyariahBadge from "../components/SyariahBadge";
import PositionPanel from "../components/PositionPanel";
import { useWatchlist } from "../lib/useWatchlist";
import { usePositions } from "../lib/usePositions";
import { buildDisplayView } from "../lib/displayMoney";

const RANGE_OPTIONS = [
  { value: "6mo", label: "6 bulan" },
  { value: "1y", label: "1 tahun" },
  { value: "2y", label: "2 tahun" },
];

export default function Home() {
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState("IDX");
  const [range, setRange] = useState("1y");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  /** Display currency for US/CRYPTO (IDX always IDR). */
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const debounceRef = useRef(null);
  const searchSeqRef = useRef(0);
  const skipSearchRef = useRef(false);
  const watchlist = useWatchlist();
  const positions = usePositions();

  function closeSuggestions() {
    searchSeqRef.current += 1; // drop any in-flight / pending search
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  /** Update ticker input without re-triggering autocomplete. */
  function setSymbolQuiet(next) {
    skipSearchRef.current = true;
    closeSuggestions();
    setSymbol(next);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Programmatic symbol updates (dropdown / watchlist / posisi) must not
    // re-open the autocomplete list.
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      setSuggestions([]);
      return;
    }

    if (!symbol || symbol.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: symbol.trim(),
          market,
        });
        const res = await fetch(`/api/search?${params.toString()}`);
        const json = await res.json();
        if (seq !== searchSeqRef.current) return;
        setSuggestions(json.results || []);
      } catch {
        if (seq !== searchSeqRef.current) return;
        setSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [symbol, market]);

  function toInputSymbol(sym, mkt) {
    if (mkt === "IDX") return sym.replace(/\.JK$/i, "");
    if (mkt === "CRYPTO") return sym.replace(/-USD$/i, "");
    return sym;
  }

  function inferMarketFromSuggestion(s) {
    if (s.quoteType === "CRYPTOCURRENCY" || /-USD$/i.test(s.symbol)) return "CRYPTO";
    if (/\.JK$/i.test(s.symbol)) return "IDX";
    return "US";
  }

  async function runForecast(chosenSymbol = symbol, chosenMarket = market) {
    if (!chosenSymbol.trim()) return;
    closeSuggestions();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        symbol: chosenSymbol.trim(),
        market: chosenMarket,
        range,
      });
      const res = await fetch(`/api/stock?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengambil data");
      setData(json);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function selectFromWatchlist(entry) {
    setSymbolQuiet(toInputSymbol(entry.symbol, entry.market));
    setMarket(entry.market);
    runForecast(entry.symbol, entry.market);
  }

  function selectFromPosition(entry) {
    setSymbolQuiet(toInputSymbol(entry.symbol, entry.market));
    setMarket(entry.market);
    runForecast(entry.symbol, entry.market);
  }

  const inWatchlist = data ? watchlist.has(data.symbol, market) : false;
  const showFxToggle = market === "CRYPTO" || market === "US";
  const view = useMemo(
    () => buildDisplayView(data, showFxToggle ? displayCurrency : "IDR"),
    [data, displayCurrency, showFxToggle]
  );

  return (
    <main className="min-h-screen">
      <header className="border-b border-board-line/80 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest2 text-board-gold/80">
              Papan bursa pribadi
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold italic tracking-tight text-board-ink text-shadow-glow sm:text-4xl">
              Papan
            </h1>
          </div>
          <span className="hidden font-mono text-[11px] uppercase tracking-widest2 text-board-dim sm:block">
            IDX · US · CRYPTO
          </span>
        </div>
      </header>

      <TickerTape
        symbol={data?.symbol}
        dates={data?.dates}
        closes={view.closes || data?.closes}
        currency={view.currency || data?.currency}
      />

      <section className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runForecast();
          }}
          className={`board-panel relative animate-fade-up flex flex-col gap-3 overflow-visible p-4 sm:flex-row sm:items-end sm:p-5 ${
            suggestions.length > 0 ? "z-40 board-panel--menu-open" : ""
          }`}
        >
          <div
            className={`relative flex-1 ${
              suggestions.length > 0 ? "z-50" : ""
            }`}
          >
            <label className="board-label">Ticker</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={
                market === "IDX" ? "cth. BBCA" : market === "CRYPTO" ? "cth. BTC" : "cth. AAPL"
              }
              className="board-input"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="board-autocomplete">
                {suggestions.map((s) => (
                  <li key={s.symbol}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const nextMarket =
                          market === "CRYPTO" ? "CRYPTO" : inferMarketFromSuggestion(s);
                        setMarket(nextMarket);
                        setSymbolQuiet(toInputSymbol(s.symbol, nextMarket));
                        runForecast(s.symbol, nextMarket);
                      }}
                    >
                      <span className="font-mono text-board-ink">{s.symbol}</span>
                      <span className="truncate pl-3 text-xs text-board-dim">{s.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="board-label">Bursa</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="board-input"
            >
              <option value="IDX">IDX</option>
              <option value="US">US</option>
              <option value="CRYPTO">CRYPTO</option>
            </select>
          </div>

          <div>
            <label className="board-label">Rentang</label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="board-input"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {showFxToggle && (
            <div>
              <label className="board-label">Tampil</label>
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="board-input"
                title="Konversi tampilan via kurs Yahoo USD/IDR (bukan pair BIDR Binance)"
              >
                <option value="USD">USD ($)</option>
                <option value="IDR">Rupiah (Rp)</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className="board-btn-primary">
            {loading ? "Memuat…" : "Forecast"}
          </button>
        </form>

        {error && (
          <p className="mt-4 animate-fade-up rounded-sm border border-board-down/50 bg-board-down/10 px-4 py-3 text-sm text-board-down">
            {error}
          </p>
        )}

        {watchlist.hydrated && (
          <div className="mt-10 animate-fade-up">
            <h2 className="board-section-title mb-3">Watchlist</h2>
            <Watchlist
              list={watchlist.list}
              onRemove={watchlist.remove}
              onSelect={selectFromWatchlist}
            />
          </div>
        )}

        {!data && positions.hydrated && positions.list.length > 0 && (
          <div className="mt-10 animate-fade-up">
            <PositionPanel
              data={null}
              market={market}
              positions={positions.list}
              onAdd={positions.add}
              onUpdate={positions.update}
              onClose={positions.close}
              onRemove={positions.remove}
              onSelect={selectFromPosition}
            />
          </div>
        )}

        {data && (
          <div className="mt-10 space-y-8 animate-fade-up">
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
                    {data.symbol} · {data.exchangeName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl text-board-ink sm:text-3xl">
                      {data.longName}
                    </h2>
                    <SyariahBadge syariah={data.syariah} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    inWatchlist
                      ? watchlist.remove(data.symbol, market)
                      : watchlist.add(data.symbol, market)
                  }
                  className={`rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 transition ${
                    inWatchlist
                      ? "border-board-down/60 text-board-down hover:bg-board-down/10"
                      : "border-board-gold text-board-gold hover:bg-board-gold/10"
                  }`}
                >
                  {inWatchlist ? "− watchlist" : "+ watchlist"}
                </button>
              </div>
              <div className="board-panel p-4 sm:p-5">
                {view.fxNote && (
                  <p className="mb-2 font-mono text-[10px] text-board-dim">{view.fxNote}</p>
                )}
                <PriceChart
                  dates={data.dates}
                  closes={view.closes}
                  sma20={view.sma20}
                  sma50={view.sma50}
                  forecast={view.forecast}
                  currency={view.currency}
                />
              </div>
            </div>

            <SignalBoard
              signal={view.signal}
              currency={view.currency}
              price={view.price}
            />

            {positions.hydrated && (
              <PositionPanel
                data={data}
                market={market}
                positions={positions.list}
                onAdd={positions.add}
                onUpdate={positions.update}
                onClose={positions.close}
                onRemove={positions.remove}
                onSelect={selectFromPosition}
                displayCurrency={showFxToggle ? displayCurrency : null}
                usdIdr={data.fx?.usdIdr ?? null}
              />
            )}

            <FundamentalPanel
              fundamental={view.fundamental}
              currency={view.currency}
              market={data.market || market}
            />

            <AdvancedSignal advanced={data.advanced} />

            <p className="board-panel-soft px-4 py-3 font-mono text-[11px] leading-relaxed text-board-dim">
              Bukan nasihat keuangan. Forecast memakai sinyal teknikal selektif (rezim
              tren/sideways, SMA, RSI, MACD, Bollinger, volume, ATR, relative strength)
              {market === "CRYPTO"
                ? " untuk crypto (tanpa valuasi fundamental) — volatilitas aset digital bisa sangat tinggi."
                : " plus valuasi fundamental — bukan jaminan pergerakan harga."}{" "}
              Hit-rate di panel sinyal adalah uji historis pada ticker yang sama, bukan
              prediksi akurasi ke depan. Status syariah berbasis referensi lokal terbatas
              (khusus saham IDX) — verifikasi mandiri sebelum dijadikan acuan keputusan.
            </p>
          </div>
        )}

        {!data && !error && !loading && (
          <div className="mt-14 animate-fade-up text-center">
            <p className="font-display text-4xl italic text-board-ink/25 sm:text-5xl">Papan</p>
            <p className="mx-auto mt-3 max-w-md font-mono text-sm leading-relaxed text-board-dim">
              Masukkan kode saham atau crypto (BTC, ETH, …) untuk melihat proyeksi tren,
              sinyal beli/jual, dan hit-rate historis dalam satu papan.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
