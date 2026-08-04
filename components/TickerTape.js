"use client";

export default function TickerTape({ symbol, dates, closes, currency }) {
  if (!closes || closes.length < 2) {
    return (
      <div className="w-full border-y border-board-line bg-board-panel2 py-2 text-center text-xs tracking-widest2 text-board-dim font-mono uppercase">
        Cari saham untuk mulai memantau papan
      </div>
    );
  }

  const window = closes.slice(-30);
  const dateWindow = dates.slice(-30);
  const changes = window.map((c, i) => {
    if (i === 0) return { pct: 0, close: c, date: dateWindow[i] };
    const pct = ((c - window[i - 1]) / window[i - 1]) * 100;
    return { pct, close: c, date: dateWindow[i] };
  });

  const strip = [...changes, ...changes]; // duplicate for seamless loop

  const fmt = (n) =>
    currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  return (
    <div className="w-full overflow-hidden border-y border-board-line bg-board-panel2">
      <div className="flex w-max animate-marquee py-2 font-mono text-xs">
        {strip.map((c, i) => (
          <span key={i} className="mx-4 flex items-center gap-2 whitespace-nowrap">
            <span className="text-board-dim">{symbol}</span>
            <span className="text-board-ink">{fmt(c.close)}</span>
            <span className={c.pct >= 0 ? "text-board-up" : "text-board-down"}>
              {c.pct >= 0 ? "▲" : "▼"} {Math.abs(c.pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
