"use client";

/**
 * Label with hover/focus tooltip. Keeps copy short in the UI while
 * explaining jargon (SMA, RSI, CAGR, …) without cluttering the board.
 */
export default function InfoTip({ label, tip, className = "" }) {
  return (
    <span className={`group relative inline-flex max-w-full items-center gap-1 ${className}`}>
      <span className="border-b border-dotted border-board-dim/50">{label}</span>
      <button
        type="button"
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-board-line font-mono text-[9px] leading-none text-board-dim outline-none hover:border-board-gold hover:text-board-gold focus-visible:border-board-gold focus-visible:text-board-gold"
        aria-label={tip}
        title={tip}
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-56 rounded-sm border border-board-line bg-board-panel2 px-2.5 py-2 font-mono text-[10px] font-normal normal-case leading-relaxed tracking-normal text-board-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:w-64"
      >
        {tip}
      </span>
    </span>
  );
}
