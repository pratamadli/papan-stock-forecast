"use client";

const STYLES = {
  syariah: { label: "✅ Syariah", className: "border-board-up text-board-up" },
  "non-syariah": { label: "❌ Non-Syariah", className: "border-board-down text-board-down" },
  unknown: { label: "⚠️ Belum Terverifikasi", className: "border-board-gold text-board-gold" },
  "not-applicable": { label: "— N/A (bukan IDX)", className: "border-board-line text-board-dim" },
};

export default function SyariahBadge({ syariah }) {
  if (!syariah) return null;
  const style = STYLES[syariah.status] || STYLES.unknown;

  return (
    <div className={`inline-flex flex-col gap-0.5 rounded-sm border px-2.5 py-1.5 ${style.className}`}>
      <span className="font-mono text-xs font-semibold">{style.label}</span>
      {syariah.note && (
        <span className="max-w-[220px] font-mono text-[10px] leading-tight text-board-dim">
          {syariah.note}
        </span>
      )}
      {syariah.asOf && !syariah.note && (
        <span className="font-mono text-[10px] text-board-dim">per {syariah.asOf}</span>
      )}
    </div>
  );
}
