"use client";

import InfoTip from "./InfoTip";
import { INDICATOR_TIPS } from "../lib/indicatorTips";

export default function FundamentalPanel({ fundamental, currency, currentYear }) {
  if (!fundamental) {
    return (
      <div className="rounded-sm border border-board-line bg-board-panel p-5">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
          Valuasi Fundamental
        </span>
        <p className="mt-2 font-mono text-xs text-board-dim">
          Data fundamental (EPS/laba historis) belum tersedia untuk ticker ini.
        </p>
      </div>
    );
  }

  const {
    growthBasis,
    growthRate,
    priceCagr,
    dividendYield,
    projectedByYear,
    marginOfSafety,
    intrinsicValueNow,
    fairValueNote,
    years,
    dataQuality,
  } = fundamental;

  const fmtPrice = (n) => {
    if (n == null) return "—";
    return currency === "IDR"
      ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
      : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  };

  const fmtPct = (n) => (n == null ? "—" : `${(n * 100).toFixed(2)}%`);

  const mosPositive = marginOfSafety != null && marginOfSafety > 0;

  return (
    <div className="rounded-sm border border-board-line bg-board-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
          Valuasi Fundamental
        </span>
        {dataQuality && dataQuality !== "ok" && (
          <span className="font-mono text-[10px] text-board-gold">
            {dataQuality === "limited" ? "data historis terbatas" : "data tidak cukup"}
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-5">
        <Stat
          label="Harga Wajar"
          value={fmtPrice(intrinsicValueNow)}
          highlight={marginOfSafety != null ? (mosPositive ? "up" : "down") : null}
        />
        <Stat
          label={`CAGR (${growthBasis === "revenue" ? "revenue" : "laba"})`}
          tip={INDICATOR_TIPS.CAGR}
          value={fmtPct(growthRate)}
        />
        <Stat
          label="CAGR harga"
          tip={INDICATOR_TIPS.CAGR_HARGA}
          value={fmtPct(priceCagr)}
        />
        <Stat label="Dividend Yield" value={fmtPct(dividendYield)} />
        <Stat
          label="Margin of Safety"
          value={fmtPct(marginOfSafety)}
          highlight={marginOfSafety != null ? (mosPositive ? "up" : "down") : null}
        />
      </div>

      {fairValueNote && (
        <p className="mb-4 font-mono text-[11px] leading-relaxed text-board-ink/80">
          {fairValueNote}
        </p>
      )}

      {projectedByYear.length > 0 && (
        <div className="mb-1 overflow-x-auto">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
            Harga wajar selama rentang {years} tahun
          </div>
          <table className="w-full min-w-[520px] font-mono text-xs">
            <thead>
              <tr className="text-board-dim">
                <th className="pb-1 text-left">Tahun</th>
                <th className="pb-1 text-right">Proyeksi Harga</th>
                <th className="pb-1 text-right">Harga Wajar (hari ini)</th>
                <th className="pb-1 pl-3 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {projectedByYear.map((p) => (
                <tr key={p.year} className="border-t border-board-line align-top">
                  <td className="py-1.5">
                    {(currentYear || new Date().getFullYear()) + p.year}
                  </td>
                  <td className="py-1.5 text-right text-board-ink">{fmtPrice(p.price)}</td>
                  <td
                    className={`py-1.5 text-right ${
                      p.gapPct > 0.1
                        ? "text-board-up"
                        : p.gapPct < -0.1
                        ? "text-board-down"
                        : "text-board-ink"
                    }`}
                  >
                    {fmtPrice(p.fairValueNow)}
                  </td>
                  <td className="py-1.5 pl-3 text-left text-board-dim">{p.keterangan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] leading-relaxed text-board-dim">
        Proyeksi = EPS sekarang × (1+CAGR)^tahun × P/E saat ini. Harga wajar hari ini =
        proyeksi harga di tahun tersebut didiskon balik dengan required return 15% (
        {fmtPrice(intrinsicValueNow)} di horizon akhir). Asumsi sederhana (P/E tetap, growth
        historis berlanjut) — panduan kasar, bukan valuasi presisi.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight, tip }) {
  const color =
    highlight === "up" ? "text-board-up" : highlight === "down" ? "text-board-down" : "text-board-ink";
  return (
    <div className="rounded-sm border border-board-line px-2 py-1.5">
      <div className="text-board-dim">
        {tip ? <InfoTip label={label} tip={tip} /> : label}
      </div>
      <div className={color}>{value}</div>
    </div>
  );
}
