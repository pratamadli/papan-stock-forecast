"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import TickerTape from "../components/TickerTape";
import PriceChart from "../components/PriceChart";
import SignalBoard from "../components/SignalBoard";
import Watchlist from "../components/Watchlist";
import AdvancedSignal from "../components/AdvancedSignal";
import FundamentalPanel from "../components/FundamentalPanel";
import SyariahBadge from "../components/SyariahBadge";
import PositionPanel from "../components/PositionPanel";
import LandingShowcase from "../components/LandingShowcase";
import SignalLeaders from "../components/SignalLeaders";
import { useWatchlist } from "../lib/useWatchlist";
import { usePositions } from "../lib/usePositions";
import { buildDisplayView } from "../lib/displayMoney";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
  const forecastSeqRef = useRef(0);
  const forecastAbortRef = useRef(null);
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
    let controller = null;

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
      controller = new AbortController();
      try {
        const params = new URLSearchParams({
          q: symbol.trim(),
          market,
        });
        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (seq !== searchSeqRef.current) return;
        setSuggestions(json.results || []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        if (seq !== searchSeqRef.current) return;
        setSuggestions([]);
      }
    }, 350);
    return () => {
      clearTimeout(debounceRef.current);
      controller?.abort();
    };
  }, [symbol, market]);

  useEffect(() => {
    return () => forecastAbortRef.current?.abort();
  }, []);

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
    forecastAbortRef.current?.abort();
    const controller = new AbortController();
    forecastAbortRef.current = controller;
    const seq = ++forecastSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        symbol: chosenSymbol.trim(),
        market: chosenMarket,
        range,
      });
      const res = await fetch(`/api/stock?${params.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (seq !== forecastSeqRef.current) return;
      if (!res.ok) throw new Error(json.error || "Gagal mengambil data");
      setData(json);
    } catch (err) {
      if (err?.name === "AbortError" || seq !== forecastSeqRef.current) return;
      setError(err.message);
      setData(null);
    } finally {
      if (seq === forecastSeqRef.current) {
        setLoading(false);
        forecastAbortRef.current = null;
      }
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

  function selectFromLeader(entry) {
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
  const showLanding = !data && !error && !loading;

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_-8px_rgba(45,212,191,0.6)]">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest2 text-primary/80">
                Secure personal desk
              </p>
              <h1 className="font-display text-2xl font-semibold italic tracking-tight text-foreground text-shadow-glow sm:text-3xl">
                Papan
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">
              IDX · US · CRYPTO
            </Badge>
            <Badge variant="success" className="gap-1">
              <ShieldCheck className="size-3" />
              Local-first
            </Badge>
          </div>
        </div>
      </header>

      <TickerTape
        symbol={data?.symbol}
        dates={data?.dates}
        closes={view.closes || data?.closes}
        currency={view.currency || data?.currency}
      />

      <section className="mx-auto max-w-6xl px-6 py-8 sm:px-10">
        {showLanding && (
          <div className="mb-8 animate-fade-up">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.02] to-transparent px-6 py-10 sm:px-10 sm:py-14">
              <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-teal-400/15 blur-3xl animate-pulse-glow" />
              <div className="pointer-events-none absolute -bottom-24 left-10 size-56 rounded-full bg-sky-500/10 blur-3xl" />
              <p className="font-mono text-[11px] uppercase tracking-widest2 text-teal-300/90">
                Dark fintech desk
              </p>
              <h2 className="mt-3 max-w-xl font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                Papan
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Forecast saham & crypto dengan sinyal selektif, chart proyeksi, dan vault
                posisi lokal — rasa modern, data tetap di perangkat Anda.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="secondary">Glass UI</Badge>
                <Badge variant="secondary">No API key</Badge>
                <Badge variant="secondary">Yahoo via server</Badge>
              </div>
            </div>
          </div>
        )}

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
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={
                market === "IDX" ? "cth. BBCA" : market === "CRYPTO" ? "cth. BTC" : "cth. AAPL"
              }
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
                      <span className="font-mono text-foreground">{s.symbol}</span>
                      <span className="truncate pl-3 text-xs text-muted-foreground">
                        {s.name}
                      </span>
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

          <Button type="submit" disabled={loading} variant="gold" size="lg" className="sm:h-10">
            {loading ? "Memuat…" : "Forecast"}
          </Button>
        </form>

        {error && (
          <Card className="mt-4 animate-fade-up border-board-down/40 bg-board-down/10">
            <CardContent className="p-4 text-sm text-board-down">{error}</CardContent>
          </Card>
        )}

        <div className="mt-10">
          <SignalLeaders market={market} onSelect={selectFromLeader} />
        </div>

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
                  <p className="font-mono text-[11px] uppercase tracking-widest2 text-muted-foreground">
                    {data.symbol} · {data.exchangeName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-2xl text-foreground sm:text-3xl">
                      {data.longName}
                    </h2>
                    <SyariahBadge syariah={data.syariah} />
                  </div>
                </div>
                <Button
                  type="button"
                  variant={inWatchlist ? "destructive" : "gold"}
                  size="sm"
                  onClick={() =>
                    inWatchlist
                      ? watchlist.remove(data.symbol, market)
                      : watchlist.add(data.symbol, market)
                  }
                >
                  {inWatchlist ? "− watchlist" : "+ watchlist"}
                </Button>
              </div>
              <Card className="p-4 sm:p-5">
                {view.fxNote && (
                  <p className="mb-2 font-mono text-[10px] text-muted-foreground">
                    {view.fxNote}
                  </p>
                )}
                <PriceChart
                  dates={data.dates}
                  closes={view.closes}
                  sma20={view.sma20}
                  sma50={view.sma50}
                  forecast={view.forecast}
                  currency={view.currency}
                />
              </Card>
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

            <p className="board-panel-soft px-4 py-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
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

        {showLanding && <LandingShowcase />}
      </section>
    </main>
  );
}
