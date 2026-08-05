"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const MARKETS = ["IDX", "US", "CRYPTO"];

const REGIME_LABEL = {
  trending: "Tren",
  sideways: "Sideways",
  mixed: "Campuran",
};

function fmtPrice(n, currency) {
  if (n == null || Number.isNaN(n)) return "—";
  if (currency === "IDR") {
    return `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 100 ? 2 : 4,
  })}`;
}

function fmtScore(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Number(n).toFixed(2)}`;
}

function fmtConf(n) {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

function LeaderTable({ title, tone, rows, onSelect, emptyHint }) {
  const toneClass =
    tone === "buy"
      ? "border-board-up/40 text-board-up"
      : tone === "sell"
      ? "border-board-down/40 text-board-down"
      : "border-board-hold/40 text-board-hold";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className={`font-mono text-sm uppercase tracking-widest2 ${toneClass}`}>
            {title}
          </CardTitle>
          <Badge variant="outline">{rows.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {rows.length === 0 ? (
          <p className="px-5 pb-5 font-mono text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left font-mono text-xs">
              <thead>
                <tr className="border-y border-white/5 text-[10px] uppercase tracking-widest2 text-muted-foreground">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Symbol</th>
                  <th className="px-2 py-2 font-medium text-right">Harga</th>
                  <th className="px-2 py-2 font-medium text-right">Skor</th>
                  <th className="px-2 py-2 font-medium text-right">Yakin</th>
                  <th className="px-4 py-2 font-medium">Rezim</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.symbol}
                    className="border-b border-white/5 last:border-b-0 transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => onSelect?.(row)}
                        className="font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                        title={row.name || row.symbol}
                      >
                        {row.symbol}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">
                      {fmtPrice(row.price, row.currency)}
                    </td>
                    <td
                      className={`px-2 py-2.5 text-right font-semibold ${
                        row.score > 0
                          ? "text-board-up"
                          : row.score < 0
                          ? "text-board-down"
                          : "text-board-hold"
                      }`}
                    >
                      {fmtScore(row.score)}
                    </td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">
                      {fmtConf(row.confidence)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {REGIME_LABEL[row.regime] || row.regime || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SignalLeaders({ market: initialMarket = "IDX", onSelect }) {
  const [market, setMarket] = useState(initialMarket);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (mkt, refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ market: mkt, range: "6mo" });
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/leaders?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat leaderboard");
      setData(json);
    } catch (err) {
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMarket(initialMarket);
  }, [initialMarket]);

  useEffect(() => {
    load(market, false);
  }, [market, load]);

  function handleSelect(row) {
    onSelect?.({
      symbol: row.symbol,
      market,
    });
  }

  return (
    <section className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="board-section-title">Leaderboard sinyal</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Top 10 BELI / JUAL / TAHAN dari universe curated likuid — bukan seluruh bursa.
            Klik symbol untuk buka forecast.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {MARKETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarket(m)}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 transition ${
                  market === m
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => load(market, true)}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </Button>
        </div>
      </div>

      {loading && !data && (
        <Card>
          <CardContent className="py-10 text-center font-mono text-sm text-muted-foreground">
            Memindai universe {market}… (bisa 15–40 detik pertama kali)
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-board-down/40 bg-board-down/10">
          <CardContent className="py-4 text-sm text-board-down">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground">
            <span>
              Dipindai {data.scanned}/{data.universeSize} ticker · range {data.range}
            </span>
            {data.cached && <Badge variant="secondary">cache ~15m</Badge>}
            {loading && <Badge variant="outline">memperbarui…</Badge>}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <LeaderTable
              title="Top 10 beli"
              tone="buy"
              rows={data.buy || []}
              onSelect={handleSelect}
              emptyHint="Belum ada sinyal BELI di universe ini."
            />
            <LeaderTable
              title="Top 10 jual"
              tone="sell"
              rows={data.sell || []}
              onSelect={handleSelect}
              emptyHint="Belum ada sinyal JUAL di universe ini."
            />
            <LeaderTable
              title="Top 10 tahan"
              tone="hold"
              rows={data.hold || []}
              onSelect={handleSelect}
              emptyHint="Tidak ada HOLD (jarang terjadi)."
            />
          </div>
          <CardDescription className="mt-3">
            TAHAN diurutkan |skor| tertinggi (paling mendekati ambang). Daftar universe di{" "}
            <code className="text-[10px]">data/signal-universe.json</code>.
          </CardDescription>
        </>
      )}
    </section>
  );
}
