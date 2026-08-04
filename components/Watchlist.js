"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { exportWatchlistCsv } from "../lib/exportCsv";

const ACTION_STYLES = {
  BUY: { label: "BELI", color: "text-board-up", border: "border-board-up" },
  SELL: { label: "JUAL", color: "text-board-down", border: "border-board-down" },
  HOLD: { label: "TAHAN", color: "text-board-gold", border: "border-board-gold" },
};

function WatchCard({ entry, onRemove, onSelect, onSnapshot }) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const params = new URLSearchParams({
        symbol: entry.symbol,
        market: entry.market,
        range: "6mo",
      });
      const res = await fetch(`/api/stock?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat");
      setState({ status: "ready", data: json, error: null });
      onSnapshot?.(entry, {
        price: json.closes[json.closes.length - 1],
        currency: json.currency,
        signal: json.signal?.action,
        score: json.signal?.score,
        syariah: json.syariah?.status,
      });
    } catch (err) {
      setState({ status: "error", data: null, error: err.message });
      onSnapshot?.(entry, null);
    }
  }, [entry, onSnapshot]);

  useEffect(() => {
    load();
  }, [load]);

  const style = state.data ? ACTION_STYLES[state.data.signal.action] : null;
  const price = state.data?.closes?.[state.data.closes.length - 1];
  const fmt = (n) => {
    if (n == null) return "—";
    return state.data?.currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-sm border bg-board-panel/90 px-4 py-3 backdrop-blur-sm transition hover:bg-board-panel ${
        style ? style.border : "border-board-line"
      }`}
    >
      <button
        type="button"
        onClick={() => state.data && onSelect(entry)}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <span className="font-mono text-sm text-board-ink">{entry.symbol}</span>
        {state.status === "loading" && (
          <span className="font-mono text-xs text-board-dim">memuat…</span>
        )}
        {state.status === "error" && (
          <span className="font-mono text-xs text-board-down">{state.error}</span>
        )}
        {state.status === "ready" && (
          <>
            <span className="font-mono text-xs text-board-dim">{fmt(price)}</span>
            <span className={`font-mono text-xs font-semibold ${style.color}`}>
              {style.label}
            </span>
            <span className="font-mono text-[11px] text-board-dim">
              skor {state.data.signal.score > 0 ? "+" : ""}
              {state.data.signal.score}
            </span>
            {state.data.syariah?.status === "syariah" && (
              <span className="font-mono text-[11px] text-board-up">✓ syariah</span>
            )}
            {state.data.syariah?.status === "non-syariah" && (
              <span className="font-mono text-[11px] text-board-down">✗ non-syariah</span>
            )}
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => onRemove(entry.symbol, entry.market)}
        className="font-mono text-xs text-board-dim hover:text-board-down"
        aria-label={`Hapus ${entry.symbol} dari watchlist`}
      >
        hapus
      </button>
    </div>
  );
}

export default function Watchlist({ list, onRemove, onSelect }) {
  const snapshotsRef = useRef({});

  const onSnapshot = useCallback((entry, snap) => {
    const key = `${entry.symbol}|${entry.market}`;
    if (snap) snapshotsRef.current[key] = { ...entry, ...snap };
    else delete snapshotsRef.current[key];
  }, []);

  const handleExport = () => {
    const rows = list.map((entry) => {
      const key = `${entry.symbol}|${entry.market}`;
      const snap = snapshotsRef.current[key];
      return {
        symbol: entry.symbol,
        market: entry.market,
        price: snap?.price,
        currency: snap?.currency,
        signal: snap?.signal,
        score: snap?.score,
        syariah: snap?.syariah,
      };
    });
    exportWatchlistCsv(rows);
  };

  if (list.length === 0) {
    return (
      <p className="font-mono text-xs text-board-dim">
        Watchlist kosong. Cari saham lalu tekan &quot;+ watchlist&quot; buat mulai pantau.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-sm border border-board-line px-2 py-1 font-mono text-[11px] uppercase tracking-widest2 text-board-dim hover:border-board-gold hover:text-board-gold"
        >
          Ekspor CSV
        </button>
      </div>
      {list.map((entry) => (
        <WatchCard
          key={`${entry.symbol}-${entry.market}`}
          entry={entry}
          onRemove={onRemove}
          onSelect={onSelect}
          onSnapshot={onSnapshot}
        />
      ))}
    </div>
  );
}
