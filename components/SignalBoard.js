"use client";

import InfoTip from "./InfoTip";
import { INDICATOR_TIPS } from "../lib/indicatorTips";

const ACTION_STYLES = {
  BUY: { label: "BELI", color: "text-board-up", border: "border-board-up" },
  SELL: { label: "JUAL", color: "text-board-down", border: "border-board-down" },
  HOLD: { label: "TAHAN", color: "text-board-gold", border: "border-board-gold" },
};

export default function SignalBoard({ signal, currency, price }) {
  if (!signal) return null;
  const style = ACTION_STYLES[signal.action] || ACTION_STYLES.HOLD;

  const fmt = (n) => {
    if (n == null) return "—";
    return currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  const macdHist = signal.indicators.macdHist;
  const macdLabel =
    macdHist == null
      ? "—"
      : `${macdHist > 0 ? "+" : ""}${
          currency === "IDR"
            ? macdHist.toLocaleString("id-ID", { maximumFractionDigits: 0 })
            : macdHist.toLocaleString("en-US", { maximumFractionDigits: 2 })
        }`;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div
        className={`flex flex-col items-center justify-center rounded-sm border-2 ${style.border} bg-board-panel px-6 py-8 animate-flip`}
      >
        <span className="font-mono text-xs uppercase tracking-widest2 text-board-dim">
          Sinyal
        </span>
        <span className={`mt-2 font-display text-4xl font-bold ${style.color}`}>
          {style.label}
        </span>
        <span className="mt-2 font-mono text-xs text-board-dim">
          skor {signal.score > 0 ? "+" : ""}
          {signal.score}
        </span>
      </div>

      <div className="rounded-sm border border-board-line bg-board-panel p-5">
        <div className="mb-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-3 lg:grid-cols-5">
          <Indicator label="Harga" value={fmt(price)} />
          <Indicator
            label="SMA20"
            tip={INDICATOR_TIPS.SMA20}
            value={fmt(signal.indicators.sma20)}
          />
          <Indicator
            label="SMA50"
            tip={INDICATOR_TIPS.SMA50}
            value={fmt(signal.indicators.sma50)}
          />
          <Indicator
            label="RSI14"
            tip={INDICATOR_TIPS.RSI14}
            value={signal.indicators.rsi14?.toFixed(1)}
          />
          <Indicator label="MACD" tip={INDICATOR_TIPS.MACD} value={macdLabel} />
        </div>
        <ul className="space-y-1.5 text-sm text-board-ink/90">
          {signal.reasons.map((r, i) => (
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
    <div className="rounded-sm border border-board-line px-2 py-1.5">
      <div className="text-board-dim">
        {tip ? <InfoTip label={label} tip={tip} /> : label}
      </div>
      <div className="text-board-ink">{value ?? "—"}</div>
    </div>
  );
}
