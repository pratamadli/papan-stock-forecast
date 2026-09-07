"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  buildAdvice,
  formatDateTime,
  toDatetimeLocalValue,
  toDateInputValue,
  computeCheckAt,
  CHECK_HORIZON_DAYS,
} from "../lib/positionAdvice";
import { exportPositionsCsv } from "../lib/exportCsv";

const ADVICE_STYLES = {
  jual: { label: "SARAN JUAL", color: "text-board-down", border: "border-board-down" },
  cek: { label: "SAATNYA CEK", color: "text-board-gold", border: "border-board-gold" },
  tahan: { label: "TAHAN", color: "text-board-up", border: "border-board-up" },
  sudah_dijual: { label: "TERJUAL", color: "text-board-dim", border: "border-board-line" },
};

/** IDX → Rupiah (Rp); US & CRYPTO → USD ($). Storage always uses this. */
function currencyForMarket(market, fallback) {
  if (market === "IDX") return "IDR";
  if (market === "US" || market === "CRYPTO") return "USD";
  return fallback === "IDR" ? "IDR" : "USD";
}

/** Display-only FX: USD journal → IDR when toggle + kurs available. */
function displayMeta(nativeCurrency, displayCurrency, usdIdr) {
  const can =
    displayCurrency === "IDR" &&
    nativeCurrency === "USD" &&
    typeof usdIdr === "number" &&
    usdIdr > 0;
  return {
    currency: can ? "IDR" : nativeCurrency,
    factor: can ? usdIdr : 1,
  };
}

function scaleDisplay(n, factor) {
  if (n == null || Number.isNaN(n)) return n;
  return n * factor;
}

function fmtPrice(n, currency) {
  if (n == null || Number.isNaN(n)) return "—";
  if (currency === "IDR") {
    return `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function currencyLabel(currency) {
  return currency === "IDR" ? "Rp" : "USD";
}

function fmtPct(n) {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(2)}%`;
}

function PositionCard({
  position,
  live,
  highlighted,
  onSelect,
  onClose,
  onRemove,
  onUpdate,
  displayCurrency,
  usdIdr,
}) {
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sellAt, setSellAt] = useState(toDatetimeLocalValue());
  const [sellPrice, setSellPrice] = useState("");
  const [editCheckAt, setEditCheckAt] = useState("");
  const [editTarget, setEditTarget] = useState("");

  const advice = useMemo(
    () =>
      buildAdvice({
        position,
        signal: live?.signal ?? null,
        currentPrice: live?.price ?? null,
      }),
    [position, live]
  );

  const style = ADVICE_STYLES[advice.sellAdvice] || ADVICE_STYLES.tahan;
  const nativeCurrency = currencyForMarket(
    position.market,
    position.currency || live?.currency
  );
  const rate = usdIdr ?? live?.usdIdr ?? null;
  const { currency: showCurrency, factor } = displayMeta(
    nativeCurrency,
    displayCurrency,
    rate
  );
  // Forms/edit stay in native (USD for crypto/US); cards can show IDR.
  const currency = nativeCurrency;
  const d = (n) => scaleDisplay(n, factor);

  useEffect(() => {
    if (closing && live?.price != null && sellPrice === "") {
      setSellPrice(String(live.price));
    }
  }, [closing, live?.price, sellPrice]);

  useEffect(() => {
    if (editing) {
      setEditCheckAt(toDateInputValue(position.checkAt));
      setEditTarget(
        position.targetPrice != null ? String(position.targetPrice) : ""
      );
    }
  }, [editing, position.checkAt, position.targetPrice]);

  return (
    <div
      className={`rounded-sm border bg-board-panel px-4 py-3 ${
        highlighted ? "border-board-gold" : style.border
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelect?.(position)}
          className="text-left"
        >
          <div className="font-mono text-sm text-board-ink">{position.symbol}</div>
          <div className="mt-0.5 font-mono text-[11px] text-board-dim">
            Beli {formatDateTime(position.buyAt)} @{" "}
            {fmtPrice(d(position.buyPrice), showCurrency)}
            {position.lots > 1 ? ` · ${position.lots} lot` : ""}
          </div>
        </button>
        <span className={`font-mono text-[11px] font-semibold uppercase tracking-widest2 ${style.color}`}>
          {style.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
        <Stat
          label="Harga sekarang"
          value={
            live?.status === "loading"
              ? "memuat…"
              : live?.status === "error"
              ? "gagal"
              : fmtPrice(d(advice.currentPrice), showCurrency)
          }
        />
        <Stat
          label="P&L"
          value={fmtPct(advice.pnlPct)}
          highlight={
            advice.pnlPct == null ? null : advice.pnlPct >= 0 ? "up" : "down"
          }
        />
        <Stat
          label={position.targetManual ? "Target jual · manual" : "Target jual"}
          value={fmtPrice(d(advice.targetPrice), showCurrency)}
        />
        <Stat
          label="Nominal P&L"
          value={
            advice.pnlNominal == null
              ? "—"
              : fmtPrice(d(advice.pnlNominal), showCurrency)
          }
          highlight={
            advice.pnlNominal == null ? null : advice.pnlNominal >= 0 ? "up" : "down"
          }
        />
      </div>

      <div className="mt-3 space-y-1 font-mono text-[11px]">
        <p
          className={
            advice.checkStatus === "overdue"
              ? "text-board-down"
              : advice.checkStatus === "due"
              ? "text-board-gold"
              : "text-board-dim"
          }
        >
          {advice.checkLabel}
        </p>
        <p className="text-board-ink/85">{advice.sellReason}</p>
        {position.status === "closed" && (
          <p className="text-board-dim">
            Jual {formatDateTime(position.sellAt)} @{" "}
            {fmtPrice(d(position.sellPrice), showCurrency)}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {position.status === "open" && !closing && !editing && (
          <>
            <button
              type="button"
              onClick={() => {
                setSellAt(toDatetimeLocalValue());
                setSellPrice(live?.price != null ? String(live.price) : "");
                setClosing(true);
              }}
              className="rounded-sm border border-board-down/60 px-2 py-1 font-mono text-[11px] uppercase tracking-widest2 text-board-down hover:bg-board-down/10"
            >
              Tandai terjual
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-sm border border-board-gold/60 px-2 py-1 font-mono text-[11px] uppercase tracking-widest2 text-board-gold hover:bg-board-gold/10"
            >
              Ubah target / cek
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(position.id)}
          className="rounded-sm border border-board-line px-2 py-1 font-mono text-[11px] uppercase tracking-widest2 text-board-dim hover:text-board-down"
        >
          Hapus
        </button>
      </div>

      {editing && position.status === "open" && (
        <form
          className="mt-3 grid gap-2 border-t border-board-line pt-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            onUpdate?.(position.id, {
              checkAt: editCheckAt ? `${editCheckAt}T12:00` : undefined,
              targetPrice: editTarget === "" ? null : Number(editTarget),
            });
            setEditing(false);
          }}
        >
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
              Tanggal cek (override)
            </span>
            <input
              type="date"
              value={editCheckAt}
              onChange={(e) => setEditCheckAt(e.target.value)}
              required
              className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-1.5 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
              Target jual ({currencyLabel(currency)})
            </span>
            <input
              type="number"
              step={currency === "IDR" ? "1" : "0.01"}
              min="0"
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              placeholder="kosongkan = hapus"
              className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-1.5 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="submit"
              className="rounded-sm border border-board-gold/60 bg-board-gold/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 text-board-gold"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdate?.(position.id, { resetCheckAt: true });
                setEditing(false);
              }}
              className="rounded-sm border border-board-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 text-board-dim"
              title={`Reset ke +${CHECK_HORIZON_DAYS} hari bursa dari tanggal beli`}
            >
              Reset cek
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-sm border border-board-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 text-board-dim"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {closing && position.status === "open" && (
        <form
          className="mt-3 grid gap-2 border-t border-board-line pt-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            onClose(position.id, { sellAt, sellPrice: Number(sellPrice) });
            setClosing(false);
          }}
        >
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
              Tanggal & waktu jual
            </span>
            <input
              type="datetime-local"
              value={sellAt}
              onChange={(e) => setSellAt(e.target.value)}
              required
              className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-1.5 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
              Harga jual ({currencyLabel(currency)})
            </span>
            <input
              type="number"
              step={currency === "IDR" ? "1" : "0.01"}
              min="0"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              required
              className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-1.5 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-sm border border-board-down/60 bg-board-down/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 text-board-down"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => setClosing(false)}
              className="rounded-sm border border-board-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest2 text-board-dim"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  const color =
    highlight === "up"
      ? "text-board-up"
      : highlight === "down"
      ? "text-board-down"
      : "text-board-ink";
  return (
    <div className="rounded-sm border border-board-line px-2 py-1.5">
      <div className="text-board-dim">{label}</div>
      <div className={color}>{value}</div>
    </div>
  );
}

function BuyForm({ data, market, onAdd }) {
  const lastPrice = data?.closes?.[data.closes.length - 1];
  const forecastTarget = data?.signal?.forecast?.length
    ? data.signal.forecast[data.signal.forecast.length - 1]
    : null;

  const [buyAt, setBuyAt] = useState(toDatetimeLocalValue());
  const [buyPrice, setBuyPrice] = useState(lastPrice != null ? String(lastPrice) : "");
  const [lots, setLots] = useState("1");
  const [targetPrice, setTargetPrice] = useState(
    forecastTarget != null ? String(Math.round(forecastTarget * 100) / 100) : ""
  );
  const [checkAt, setCheckAt] = useState("");
  const [useManualCheck, setUseManualCheck] = useState(false);
  const [useManualTarget, setUseManualTarget] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (lastPrice != null) setBuyPrice(String(lastPrice));
    setBuyAt(toDatetimeLocalValue());
    setTargetPrice(
      forecastTarget != null ? String(Math.round(forecastTarget * 100) / 100) : ""
    );
    setUseManualTarget(false);
    setUseManualCheck(false);
    setCheckAt("");
    setSaved(false);
  }, [data?.symbol, lastPrice, forecastTarget]);

  useEffect(() => {
    if (!useManualCheck && buyAt) {
      const auto = computeCheckAt(buyAt, CHECK_HORIZON_DAYS, market);
      setCheckAt(toDateInputValue(auto));
    }
  }, [buyAt, market, useManualCheck]);

  if (!data) return null;

  const currency = currencyForMarket(market, data.currency);

  return (
    <form
      className="rounded-sm border border-board-line bg-board-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const entry = onAdd({
          symbol: data.symbol,
          market,
          buyAt,
          buyPrice: Number(buyPrice),
          lots: Number(lots) || 1,
          targetPrice:
            targetPrice !== ""
              ? Number(targetPrice)
              : forecastTarget,
          targetManual: useManualTarget && targetPrice !== "",
          checkAt: useManualCheck && checkAt ? `${checkAt}T12:00` : null,
          checkAtManual: useManualCheck && Boolean(checkAt),
        });
        if (entry) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
          Catat beli — {data.symbol} · {currencyLabel(currency)}
        </span>
        <span className="font-mono text-[10px] text-board-dim">
          Default cek +{CHECK_HORIZON_DAYS}{" "}
          {market === "CRYPTO" ? "hari kalender (24/7)" : "hari bursa"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            Tanggal & waktu beli
          </span>
          <input
            type="datetime-local"
            value={buyAt}
            onChange={(e) => setBuyAt(e.target.value)}
            required
            className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-2 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            Harga beli ({currencyLabel(currency)})
          </span>
          <input
            type="number"
            step={currency === "IDR" ? "1" : "0.01"}
            min="0"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            required
            className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-2 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            Lot (opsional)
          </span>
          <input
            type="number"
            step="1"
            min="1"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-2 font-mono text-xs text-board-ink outline-none focus:border-board-gold"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            <span>Target jual ({currencyLabel(currency)})</span>
            <label className="flex items-center gap-1 normal-case tracking-normal">
              <input
                type="checkbox"
                checked={useManualTarget}
                onChange={(e) => setUseManualTarget(e.target.checked)}
              />
              override
            </label>
          </span>
          <input
            type="number"
            step={currency === "IDR" ? "1" : "0.01"}
            min="0"
            value={targetPrice}
            onChange={(e) => {
              setTargetPrice(e.target.value);
              setUseManualTarget(true);
            }}
            disabled={!useManualTarget && forecastTarget != null}
            className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-2 font-mono text-xs text-board-ink outline-none focus:border-board-gold disabled:opacity-60"
          />
          {!useManualTarget && forecastTarget != null && (
            <span className="mt-1 block font-mono text-[10px] text-board-dim">
              Default dari proyeksi {CHECK_HORIZON_DAYS} hari:{" "}
              {fmtPrice(forecastTarget, currency)}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            <span>Tanggal cek lagi</span>
            <label className="flex items-center gap-1 normal-case tracking-normal">
              <input
                type="checkbox"
                checked={useManualCheck}
                onChange={(e) => setUseManualCheck(e.target.checked)}
              />
              override
            </label>
          </span>
          <input
            type="date"
            value={checkAt}
            onChange={(e) => {
              setCheckAt(e.target.value);
              setUseManualCheck(true);
            }}
            disabled={!useManualCheck}
            className="w-full rounded-sm border border-board-line bg-board-panel2 px-2 py-2 font-mono text-xs text-board-ink outline-none focus:border-board-gold disabled:opacity-60"
          />
          {!useManualCheck && (
            <span className="mt-1 block font-mono text-[10px] text-board-dim">
              {market === "CRYPTO"
                ? `Otomatis +${CHECK_HORIZON_DAYS} hari kalender (pasar crypto 24/7)`
                : `Otomatis +${CHECK_HORIZON_DAYS} hari bursa (libur & weekend dilewati)`}
            </span>
          )}
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          className="rounded-sm border border-board-gold bg-board-gold/10 px-4 py-2 font-mono text-[11px] uppercase tracking-widest2 text-board-gold hover:bg-board-gold/20"
        >
          Simpan posisi
        </button>
        {saved && (
          <span className="font-mono text-[11px] text-board-up">Tersimpan</span>
        )}
      </div>
    </form>
  );
}

const LIVE_QUOTE_CONCURRENCY = 2;

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

/**
 * Live quotes for open positions — fetches a lightweight endpoint per symbol.
 * Uses data already loaded for the active ticker to avoid a duplicate request.
 */
function useLiveQuotes(positions, activeData, activeMarket) {
  const [quotes, setQuotes] = useState({});

  const keys = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of positions) {
      const key = `${p.symbol}|${p.market}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ symbol: p.symbol, market: p.market, key });
    }
    return out;
  }, [positions]);

  const load = useCallback(async (controllers = [], isCancelled = () => false) => {
    const next = {};

    if (activeData?.symbol) {
      const activeKey = `${activeData.symbol}|${activeMarket}`;
      next[activeKey] = {
        status: "ready",
        price: activeData.closes[activeData.closes.length - 1],
        signal: activeData.signal,
        currency: currencyForMarket(activeMarket, activeData.currency),
        usdIdr: activeData.fx?.usdIdr ?? null,
      };
    }

    await mapPool(
      keys,
      LIVE_QUOTE_CONCURRENCY,
      async ({ symbol, market, key }) => {
        if (isCancelled()) return;
        if (next[key]) return;
        const controller = new AbortController();
        controllers.push(controller);
        try {
          const params = new URLSearchParams({ symbol, market, range: "6mo" });
          const res = await fetch(`/api/quote?${params.toString()}`, {
            signal: controller.signal,
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Gagal memuat");
          next[key] = {
            status: "ready",
            price: json.price,
            signal: json.signal,
            currency: currencyForMarket(market, json.currency),
          };
        } catch (err) {
          if (err?.name === "AbortError") return;
          next[key] = { status: "error", error: err.message };
        }
      }
    );

    if (!isCancelled()) {
      setQuotes(next);
    }
  }, [keys, activeData, activeMarket]);

  useEffect(() => {
    let cancelled = false;
    const controllers = [];

    if (keys.length === 0) {
      setQuotes({});
      return undefined;
    }
    setQuotes((prev) => {
      const loading = {};
      for (const { key } of keys) {
        loading[key] = prev[key]?.status === "ready" ? prev[key] : { status: "loading" };
      }
      return loading;
    });
    load(controllers, () => cancelled);

    return () => {
      cancelled = true;
      controllers.forEach((controller) => controller.abort());
    };
  }, [keys, load]);

  return quotes;
}

export default function PositionPanel({
  data,
  market,
  positions,
  onAdd,
  onUpdate,
  onClose,
  onRemove,
  onSelect,
  displayCurrency = null,
  usdIdr = null,
}) {
  const open = useMemo(
    () => positions.filter((p) => p.status === "open"),
    [positions]
  );
  const closed = useMemo(
    () => positions.filter((p) => p.status === "closed").slice(0, 5),
    [positions]
  );
  const quotes = useLiveQuotes(open, data, market);
  const activeSymbol = data?.symbol;

  const handleExport = () => {
    const rows = positions.map((p) => {
      const live = quotes[`${p.symbol}|${p.market}`];
      const advice = buildAdvice({
        position: p,
        signal: live?.signal ?? null,
        currentPrice:
          p.status === "closed" ? p.sellPrice : live?.price ?? null,
      });
      return {
        symbol: p.symbol,
        market: p.market,
        status: p.status,
        buyAt: p.buyAt,
        buyPrice: p.buyPrice,
        lots: p.lots,
        checkAt: p.checkAt,
        checkAtManual: p.checkAtManual,
        targetPrice: p.targetPrice,
        targetManual: p.targetManual,
        currentPrice: advice.currentPrice,
        signal: live?.signal?.action,
        pnlPct: advice.pnlPct,
        pnlNominal: advice.pnlNominal,
        sellAt: p.sellAt,
        sellPrice: p.sellPrice,
        currency: currencyForMarket(p.market, p.currency),
      };
    });
    exportPositionsCsv(rows);
  };

  return (
    <div className="space-y-4">
      <BuyForm data={data} market={market} onAdd={onAdd} />

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
            Posisi saya
          </h2>
          {positions.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              className="rounded-sm border border-board-line px-2 py-1 font-mono text-[11px] uppercase tracking-widest2 text-board-dim hover:border-board-gold hover:text-board-gold"
            >
              Ekspor CSV
            </button>
          )}
        </div>

        {open.length === 0 && closed.length === 0 && (
          <p className="font-mono text-xs text-board-dim">
            Belum ada posisi. Forecast saham lalu isi form &quot;Catat beli&quot; di atas.
          </p>
        )}

        {open.length > 0 && (
          <div className="space-y-2">
            {open.map((p) => (
              <PositionCard
                key={p.id}
                position={p}
                live={quotes[`${p.symbol}|${p.market}`]}
                highlighted={activeSymbol === p.symbol}
                onSelect={onSelect}
                onClose={onClose}
                onRemove={onRemove}
                onUpdate={onUpdate}
                displayCurrency={displayCurrency}
                usdIdr={usdIdr}
              />
            ))}
          </div>
        )}

        {closed.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
              Riwayat terjual
            </h3>
            <div className="space-y-2">
              {closed.map((p) => (
                <PositionCard
                  key={p.id}
                  position={p}
                  live={{
                    status: "ready",
                    price: p.sellPrice,
                    signal: null,
                    currency: currencyForMarket(p.market, p.currency),
                    usdIdr,
                  }}
                  highlighted={false}
                  onSelect={onSelect}
                  onClose={onClose}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                  displayCurrency={displayCurrency}
                  usdIdr={usdIdr}
                />
              ))}
            </div>
          </div>
        )}

        <p className="mt-3 font-mono text-[10px] leading-relaxed text-board-dim">
          Saran cek/jual adalah panduan dari sinyal & proyeksi app (default ~{CHECK_HORIZON_DAYS}{" "}
          hari bursa, libur dilewati; bisa di-override), bukan jaminan. Data posisi hanya
          tersimpan di browser ini — pakai Ekspor CSV untuk backup.
          {displayCurrency === "IDR"
            ? " Angka Rupiah di kartu adalah konversi tampilan via kurs Yahoo USD/IDR; jurnal tetap disimpan dalam USD."
            : ""}
        </p>
      </div>
    </div>
  );
}
