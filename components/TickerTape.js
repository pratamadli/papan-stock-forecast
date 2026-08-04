"use client";

export default function TickerTape({ symbol, dates, closes, currency }) {
  if (!closes || closes.length < 2) {
    return (
      <div className="w-full border-y border-board-line/80 bg-board-panel2/70 py-2.5 text-center font-mono text-[11px] uppercase tracking-widest2 text-board-dim backdrop-blur-sm">
        Cari saham untuk mulai memantau papan
      </div>
    );
  }

  const windowSlice = closes.slice(-30);
  const dateWindow = dates.slice(-30);
  const changes = windowSlice.map((c, i) => {
    if (i === 0) return { pct: 0, close: c, date: dateWindow[i] };
    const pct = ((c - windowSlice[i - 1]) / windowSlice[i - 1]) * 100;
    return { pct, close: c, date: dateWindow[i] };
  });

  const strip = [...changes, ...changes];

  const fmt = (n) =>
    currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  return (
    <div className="w-full overflow-hidden border-y border-board-line/80 bg-board-panel2/75 backdrop-blur-sm">
      <div className="flex w-max animate-marquee py-2.5 font-mono text-xs">
        {strip.map((c, i) => (
          <span key={i} className="mx-5 flex items-center gap-2.5 whitespace-nowrap">
            <span className="text-board-gold/80">{symbol}</span>
            <span className="text-board-ink">{fmt(c.close)}</span>
            <span
              className={
                c.pct >= 0
                  ? "rounded-sm bg-board-up/10 px-1.5 text-board-up"
                  : "rounded-sm bg-board-down/10 px-1.5 text-board-down"
              }
            >
              {c.pct >= 0 ? "▲" : "▼"} {Math.abs(c.pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
