"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { exportWatchlistCsv } from "../lib/exportCsv";

const WATCHLIST_CONCURRENCY = 2;

const ACTION_STYLES = {
  BUY: { label: "BELI", color: "text-board-up", border: "border-board-up" },
  SELL: { label: "JUAL", color: "text-board-down", border: "border-board-down" },
  HOLD: { label: "TAHAN", color: "text-board-hold", border: "border-board-hold" },
};

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

function watchKey(entry) {
  return `${entry.symbol}|${entry.market}`;
}

function WatchCard({ entry, state, onRemove, onSelect }) {
  const current = state || { status: "loading", data: null, error: null };

  const action = current.data?.signal?.action;
  const style = current.data ? ACTION_STYLES[action] || ACTION_STYLES.HOLD : null;
  const price = current.data?.price;
  const fmt = (n) => {
    if (n == null) return "—";
    return current.data?.currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  return (
    <div
      className={`glass-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition hover:bg-white/[0.06] ${
        style ? style.border : "border-white/10"
      }`}
    >
      <button
        type="button"
        onClick={() => current.data && onSelect(entry)}
        className="flex flex-1 items-center gap-3 text-left"
      >
        <span className="font-mono text-sm text-board-ink">{entry.symbol}</span>
        {current.status === "loading" && (
          <span className="font-mono text-xs text-board-dim">memuat…</span>
        )}
        {current.status === "error" && (
          <span className="font-mono text-xs text-board-down">{current.error}</span>
        )}
        {current.status === "ready" && (
          <>
            <span className="font-mono text-xs text-board-dim">{fmt(price)}</span>
            <span className={`font-mono text-xs font-semibold ${style.color}`}>
              {style.label}
            </span>
            <span className="font-mono text-[11px] text-board-dim">
              skor {current.data.signal?.score > 0 ? "+" : ""}
              {current.data.signal?.score ?? "—"}
            </span>
            {current.data.syariah?.status === "syariah" && (
              <span className="font-mono text-[11px] text-board-up">✓ syariah</span>
            )}
            {current.data.syariah?.status === "non-syariah" && (
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
  const [states, setStates] = useState({});
  const snapshotsRef = useRef({});

  const onSnapshot = useCallback((entry, snap) => {
    const key = `${entry.symbol}|${entry.market}`;
    if (snap) snapshotsRef.current[key] = { ...entry, ...snap };
    else delete snapshotsRef.current[key];
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controllers = [];

    if (list.length === 0) {
      setStates({});
      return undefined;
    }

    setStates((prev) => {
      const next = {};
      for (const entry of list) {
        const key = watchKey(entry);
        next[key] = prev[key]?.status === "ready" ? prev[key] : { status: "loading" };
      }
      return next;
    });

    async function load() {
      const next = {};
      await mapPool(list, WATCHLIST_CONCURRENCY, async (entry) => {
        if (cancelled) return;
        const key = watchKey(entry);
        const controller = new AbortController();
        controllers.push(controller);
        try {
          const params = new URLSearchParams({
            symbol: entry.symbol,
            market: entry.market,
            range: "6mo",
          });
          const res = await fetch(`/api/quote?${params.toString()}`, {
            signal: controller.signal,
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Gagal memuat");

          const data = {
            price: json.price,
            currency: json.currency,
            signal: json.signal,
            syariah: json.syariah,
          };
          next[key] = { status: "ready", data, error: null };
          onSnapshot(entry, {
            price: json.price,
            currency: json.currency,
            signal: json.signal?.action,
            score: json.signal?.score,
            syariah: json.syariah?.status,
          });
        } catch (err) {
          if (err?.name === "AbortError") return;
          next[key] = { status: "error", data: null, error: err.message };
          onSnapshot(entry, null);
        }
      });

      if (!cancelled) {
        setStates(next);
      }
    }

    load();

    return () => {
      cancelled = true;
      controllers.forEach((controller) => controller.abort());
    };
  }, [list, onSnapshot]);

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
          state={states[watchKey(entry)]}
          onRemove={onRemove}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
