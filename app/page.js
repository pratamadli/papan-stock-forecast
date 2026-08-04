"use client";

import { useState, useRef, useEffect } from "react";
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
  const debounceRef = useRef(null);
  const watchlist = useWatchlist();
  const positions = usePositions();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!symbol || symbol.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(symbol.trim())}`);
        const json = await res.json();
        setSuggestions(json.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [symbol]);

  async function runForecast(chosenSymbol = symbol) {
    if (!chosenSymbol.trim()) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const params = new URLSearchParams({
        symbol: chosenSymbol.trim(),
        market,
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
    setSymbol(entry.symbol.replace(".JK", ""));
    setMarket(entry.market);
    runForecast(entry.symbol);
  }

  function selectFromPosition(entry) {
    setSymbol(entry.symbol.replace(".JK", ""));
    setMarket(entry.market);
    runForecast(entry.symbol);
  }

  const inWatchlist = data ? watchlist.has(data.symbol, market) : false;

  return (
    <main className="min-h-screen">
      <header className="border-b border-board-line px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-baseline justify-between">
          <h1 className="font-display text-2xl font-semibold italic text-board-ink text-shadow-glow">
            Papan
          </h1>
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
            forecast saham pribadi
          </span>
        </div>
      </header>

      <TickerTape
        symbol={data?.symbol}
        dates={data?.dates}
        closes={data?.closes}
        currency={data?.currency}
      />

      <section className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runForecast();
          }}
          className="relative flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="relative flex-1">
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
              Ticker
            </label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={market === "IDX" ? "cth. BBCA" : "cth. AAPL"}
              className="w-full rounded-sm border border-board-line bg-board-panel px-3 py-2.5 font-mono text-board-ink outline-none focus:border-board-gold focus-visible:ring-2 focus-visible:ring-board-gold"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-sm border border-board-line bg-board-panel shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.symbol}>
                    <button
                      type="button"
                      onClick={() => {
                        setSymbol(s.symbol.replace(".JK", ""));
                        setMarket(s.symbol.endsWith(".JK") ? "IDX" : "US");
                        setSuggestions([]);
                        runForecast(s.symbol);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-board-panel2"
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
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
              Bursa
            </label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="rounded-sm border border-board-line bg-board-panel px-3 py-2.5 font-mono text-board-ink outline-none focus:border-board-gold"
            >
              <option value="IDX">IDX</option>
              <option value="US">US</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
              Rentang
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="rounded-sm border border-board-line bg-board-panel px-3 py-2.5 font-mono text-board-ink outline-none focus:border-board-gold"
            >
              {RANGE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-sm border border-board-gold bg-board-gold/10 px-5 py-2.5 font-mono text-sm uppercase tracking-widest2 text-board-gold transition hover:bg-board-gold/20 disabled:opacity-50"
          >
            {loading ? "Memuat…" : "Forecast"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-sm border border-board-down/60 bg-board-down/10 px-4 py-3 text-sm text-board-down">
            {error}
          </p>
        )}

        {watchlist.hydrated && (
          <div className="mt-8">
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
              Watchlist
            </h2>
            <Watchlist
              list={watchlist.list}
              onRemove={watchlist.remove}
              onSelect={selectFromWatchlist}
            />
          </div>
        )}

        {!data && positions.hydrated && positions.list.length > 0 && (
          <div className="mt-8">
            <PositionPanel
              data={null}
              market={market}
              positions={positions.list}
              onAdd={positions.add}
              onClose={positions.close}
              onRemove={positions.remove}
              onSelect={selectFromPosition}
            />
          </div>
        )}

        {data && (
          <div className="mt-8 space-y-8">
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-xl text-board-ink">{data.longName}</h2>
                  <SyariahBadge syariah={data.syariah} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-board-dim">
                    {data.symbol} · {data.exchangeName}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      inWatchlist
                        ? watchlist.remove(data.symbol, market)
                        : watchlist.add(data.symbol, market)
                    }
                    className={`rounded-sm border px-2 py-1 font-mono text-[11px] uppercase tracking-widest2 transition ${
                      inWatchlist
                        ? "border-board-down/60 text-board-down hover:bg-board-down/10"
                        : "border-board-gold text-board-gold hover:bg-board-gold/10"
                    }`}
                  >
                    {inWatchlist ? "− watchlist" : "+ watchlist"}
                  </button>
                </div>
              </div>
              <div className="rounded-sm border border-board-line bg-board-panel p-4">
                <PriceChart
                  dates={data.dates}
                  closes={data.closes}
                  sma20={data.sma20}
                  sma50={data.sma50}
                  forecast={data.signal.forecast}
                  currency={data.currency}
                />
              </div>
            </div>

            <SignalBoard
              signal={data.signal}
              currency={data.currency}
              price={data.closes[data.closes.length - 1]}
            />

            {positions.hydrated && (
              <PositionPanel
                data={data}
                market={market}
                positions={positions.list}
                onAdd={positions.add}
                onClose={positions.close}
                onRemove={positions.remove}
                onSelect={selectFromPosition}
              />
            )}

            <FundamentalPanel fundamental={data.fundamental} currency={data.currency} />

            <AdvancedSignal advanced={data.advanced} />

            <p className="font-mono text-[11px] leading-relaxed text-board-dim">
              Bukan nasihat keuangan. Forecast dihasilkan dari tren statistik (Holt&apos;s
              linear trend), indikator teknikal (SMA, RSI, MACD), dan valuasi fundamental
              (CAGR, Margin of Safety) atas data historis — bukan jaminan pergerakan harga
              di masa depan. Status syariah berbasis data referensi lokal yang terbatas,
              bukan Daftar Efek Syariah resmi — verifikasi ke OJK/IDX sebelum dijadikan
              acuan keputusan.
            </p>
          </div>
        )}

        {!data && !error && !loading && (
          <p className="mt-10 font-mono text-sm text-board-dim">
            Masukkan kode saham untuk melihat proyeksi tren dan sinyal beli/jual.
          </p>
        )}
      </section>
    </main>
  );
}
