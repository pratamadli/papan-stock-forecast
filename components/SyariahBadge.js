"use client";

const STYLES = {
  syariah: { label: "Syariah", className: "border-board-up/70 bg-board-up/10 text-board-up" },
  "non-syariah": {
    label: "Non-syariah",
    className: "border-board-down/70 bg-board-down/10 text-board-down",
  },
  unknown: {
    label: "Belum terverifikasi",
    className: "border-board-gold/70 bg-board-gold/10 text-board-gold",
  },
  "not-applicable": {
    label: "N/A · di luar DES",
    className: "border-board-line bg-board-panel2/60 text-board-dim",
  },
};

export default function SyariahBadge({ syariah }) {
  if (!syariah) return null;
  const style = STYLES[syariah.status] || STYLES.unknown;

  return (
    <div className={`inline-flex flex-col gap-0.5 rounded-sm border px-2.5 py-1.5 ${style.className}`}>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-widest2">
        {style.label}
      </span>
      {syariah.note && (
        <span className="max-w-[220px] font-mono text-[10px] leading-tight text-board-dim normal-case tracking-normal">
          {syariah.note}
        </span>
      )}
      {syariah.asOf && !syariah.note && (
        <span className="font-mono text-[10px] text-board-dim normal-case tracking-normal">
          per {syariah.asOf}
        </span>
      )}
    </div>
  );
}
