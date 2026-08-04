"use client";

import InfoTip from "./InfoTip";
import { INDICATOR_TIPS } from "../lib/indicatorTips";

const ACTION_STYLES = {
  BUY: {
    label: "BELI",
    color: "text-board-up",
    border: "border-board-up",
    glow: "shadow-[0_0_40px_-12px_rgba(79,174,122,0.55)]",
    bar: "bg-board-up",
  },
  SELL: {
    label: "JUAL",
    color: "text-board-down",
    border: "border-board-down",
    glow: "shadow-[0_0_40px_-12px_rgba(199,84,80,0.55)]",
    bar: "bg-board-down",
  },
  HOLD: {
    label: "TAHAN",
    color: "text-board-gold",
    border: "border-board-gold",
    glow: "shadow-[0_0_40px_-12px_rgba(212,169,74,0.45)]",
    bar: "bg-board-gold",
  },
};

const REGIME_LABEL = {
  trending: "Tren",
  sideways: "Sideways",
  mixed: "Campuran",
};

export default function SignalBoard({ signal, currency, price }) {
  if (!signal) return null;
  const style = ACTION_STYLES[signal.action] || ACTION_STYLES.HOLD;
  const bt = signal.backtest;

  const fmt = (n) => {
    if (n == null) return "—";
    return currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  const macdHist = signal.indicators?.macdHist;
  const macdLabel =
    macdHist == null
      ? "—"
      : `${macdHist > 0 ? "+" : ""}${
          currency === "IDR"
            ? macdHist.toLocaleString("id-ID", { maximumFractionDigits: 0 })
            : macdHist.toLocaleString("en-US", { maximumFractionDigits: 2 })
        }`;

  const pctB = signal.indicators?.bbPercentB;
  const bbLabel = pctB == null ? "—" : pctB.toFixed(2);
  const conf = signal.confidence != null ? Math.round(signal.confidence * 100) : null;
  const confPct = conf != null ? `${conf}%` : "—";
  const hitPct =
    bt?.hitRate != null ? `${(bt.hitRate * 100).toFixed(1)}%` : "—";
  const regime = REGIME_LABEL[signal.regime] || signal.regime || "—";

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <div
        className={`flex flex-col items-center justify-center rounded-sm border-2 ${style.border} ${style.glow} bg-board-panel/95 px-6 py-9 animate-flip backdrop-blur-sm`}
      >
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
          Sinyal
        </span>
        <span className={`mt-2 font-display text-5xl font-bold tracking-tight ${style.color}`}>
          {style.label}
        </span>
        <span className="mt-3 font-mono text-xs text-board-dim">
          skor {signal.score > 0 ? "+" : ""}
          {signal.score}
          {signal.threshold != null ? ` · ambang ±${signal.threshold}` : ""}
        </span>
        <div className="mt-4 w-full max-w-[140px]">
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            <span>Keyakinan</span>
            <span className={style.color}>{confPct}</span>
          </div>
          <div className="conf-bar">
            <span
              className={style.bar}
              style={{ width: `${conf != null ? conf : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="board-panel p-5">
        <div className="mb-3 grid grid-cols-2 gap-2.5 font-mono text-xs sm:grid-cols-3 lg:grid-cols-4">
          <Indicator label="Harga" value={fmt(price)} />
          <Indicator label="Rezim" tip={INDICATOR_TIPS.REGIME} value={regime} />
          <Indicator label="Keyakinan" tip={INDICATOR_TIPS.CONFIDENCE} value={confPct} />
          <Indicator label="Hit-rate" tip={INDICATOR_TIPS.HITRATE} value={hitPct} />
          <Indicator
            label="SMA20"
            tip={INDICATOR_TIPS.SMA20}
            value={fmt(signal.indicators?.sma20)}
          />
          <Indicator
            label="SMA50"
            tip={INDICATOR_TIPS.SMA50}
            value={fmt(signal.indicators?.sma50)}
          />
          <Indicator
            label="RSI14"
            tip={INDICATOR_TIPS.RSI14}
            value={signal.indicators?.rsi14?.toFixed(1)}
          />
          <Indicator label="MACD" tip={INDICATOR_TIPS.MACD} value={macdLabel} />
          <Indicator label="%B" tip={INDICATOR_TIPS.BB} value={bbLabel} />
          <Indicator
            label="Vol"
            tip={INDICATOR_TIPS.VOLUME}
            value={
              signal.volRatio != null ? `${Math.round(signal.volRatio * 100)}%` : "—"
            }
          />
          <Indicator
            label="ATR%"
            tip={INDICATOR_TIPS.ATR}
            value={
              signal.atrPct != null ? `${(signal.atrPct * 100).toFixed(2)}%` : "—"
            }
          />
          {signal.benchmark && (
            <Indicator label="Bench" tip={INDICATOR_TIPS.RS} value={signal.benchmark} />
          )}
        </div>

        {bt && (
          <div className="mb-3 rounded-sm border border-board-line/80 bg-board-panel2/50 px-3 py-2 font-mono text-[11px] text-board-dim">
            Backtest sinyal {bt.horizon}h: {bt.samples} sampel BUY/SELL
            {bt.buySamples != null
              ? ` · beli ${(bt.buyHitRate != null
                  ? (bt.buyHitRate * 100).toFixed(0)
                  : "—")}% (${bt.buySamples})`
              : ""}
            {bt.sellSamples != null
              ? ` · jual ${(bt.sellHitRate != null
                  ? (bt.sellHitRate * 100).toFixed(0)
                  : "—")}% (${bt.sellSamples})`
              : ""}
            {bt.holdShare != null ? ` · HOLD ${(bt.holdShare * 100).toFixed(0)}%` : ""}
            {bt.note ? ` — ${bt.note}` : ""}
          </div>
        )}

        <ul className="space-y-1.5 text-sm text-board-ink/90">
          {(signal.reasons || []).map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-board-gold">—</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Indicator({ label, value, tip }) {
  return (
    <div className="board-metric">
      <div className="text-board-dim">
        {tip ? <InfoTip label={label} tip={tip} /> : label}
      </div>
      <div className="mt-0.5 text-board-ink">{value ?? "—"}</div>
    </div>
  );
}
