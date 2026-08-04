"use client";

export default function AdvancedSignal({ advanced }) {
  if (!advanced) return null;

  const { direction, probability_up, confidence, horizon_days, backtest_metrics, feature_importances } =
    advanced;

  const topFeatures = Object.entries(feature_importances || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const xgbAcc = backtest_metrics?.xgboost?.accuracy;
  const baselineAcc = backtest_metrics?.baseline_sma_trend?.accuracy;
  const beatsBaseline = xgbAcc != null && baselineAcc != null && xgbAcc > baselineAcc;

  return (
    <div className="board-panel border-board-gold/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-board-gold">
          XGBoost (local) · {horizon_days} hari ke depan
        </span>
        <span
          className={`font-mono text-sm font-semibold ${
            direction === "UP" ? "text-board-up" : "text-board-down"
          }`}
        >
          {direction === "UP" ? "▲ NAIK" : "▼ TURUN"} · {(confidence * 100).toFixed(0)}% yakin
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 font-mono text-xs">
        <div className="rounded-sm border border-board-line px-2 py-1.5">
          <div className="text-board-dim">Akurasi model (backtest)</div>
          <div className="text-board-ink">{(xgbAcc * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-sm border border-board-line px-2 py-1.5">
          <div className="text-board-dim">Akurasi baseline SMA</div>
          <div className="text-board-ink">{(baselineAcc * 100).toFixed(1)}%</div>
        </div>
      </div>

      <p className="mb-3 font-mono text-[11px] text-board-dim">
        {beatsBaseline
          ? "Model ini mengungguli baseline SMA-trend sederhana pada data historis."
          : "Model ini belum jelas lebih baik dari baseline SMA-trend sederhana pada data historis — pertimbangkan tetap pakai sinyal utama di atas."}
      </p>

      {topFeatures.length > 0 && (
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest2 text-board-dim">
            Fitur paling berpengaruh
          </div>
          <ul className="space-y-1 font-mono text-xs text-board-ink/90">
            {topFeatures.map(([name, value]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className="text-board-dim">{(value * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
