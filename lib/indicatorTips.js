// Short explanations shown as tooltips next to indicator labels.

export const INDICATOR_TIPS = {
  SMA20:
    "Simple Moving Average 20 hari — rata-rata harga penutupan 20 hari bursa terakhir. Digunakan sebagai tren jangka pendek. Jika harga/SMA20 di atas SMA50, tren pendek cenderung naik.",
  SMA50:
    "Simple Moving Average 50 hari — rata-rata harga penutupan 50 hari bursa terakhir. Digunakan sebagai tren menengah. SMA20 di bawah SMA50 biasanya menandakan tren pendek melemah.",
  RSI14:
    "Relative Strength Index 14 hari — mengukur momentum (skala 0–100). Di bawah 30 = oversold (berpotensi rebound). Di atas 70 = overbought (rawan koreksi). Di antaranya dianggap netral.",
  MACD:
    "Moving Average Convergence Divergence — selisih EMA cepat & lambat, ditampilkan sebagai histogram. Golden cross (histogram berbalik positif) = momentum naik; death cross = momentum turun.",
  BB:
    "Bollinger Bands (20, 2σ) — pita volatilitas di sekitar SMA20. %B mendekati 0 = harga di band bawah (oversold); mendekati 1 = di band atas (overbought). Bobot lebih besar saat rezim sideways.",
  REGIME:
    "Rezim pasar diestimasi dari |SMA20−SMA50| / ATR. Tren (≥2×ATR): bobot SMA/MACD/Holt naik. Sideways (≤1×ATR): bobot RSI/Bollinger naik. Campuran: bobot seimbang.",
  CONFIDENCE:
    "Keyakinan gabungan dari kesepakatan arah antar-indikator dan seberapa jauh skor melewati ambang BUY/SELL. Bukan probabilitas harga — makin tinggi, makin selektif sinyalnya.",
  HITRATE:
    "Persentase sinyal BUY/SELL historis pada ticker ini yang arahnya benar setelah ~10 hari bursa (walk-forward di server). Sedikit sampel = kurang andal. Bukan jaminan hasil ke depan.",
  VOLUME:
    "Volume hari ini vs rata-rata 20 hari. BUY/SELL ditahan (jadi HOLD) jika volume < 85% rata-rata — mengurangi sinyal tanpa partisipasi pasar.",
  ATR:
    "Average True Range 14 hari sebagai % harga. Volatilitas tinggi memperketat ambang sinyal agar lebih jarang BUY/SELL di pasar choppy.",
  RS:
    "Relative strength vs acuan: ^JKSE (IDX), SPY (US), BTC-USD atau ETH-USD (CRYPTO). Di atas rata-rata relatif acuan = skor bullish tambahan.",
  CAGR:
    "Compound Annual Growth Rate — laju pertumbuhan tahunan majemuk dari laba (atau revenue jika laba tidak tersedia). Dipakai untuk memperkirakan pertumbuhan bisnis ke depan, lalu di-clamp agar tidak terlalu ekstrem.",
  CAGR_HARGA:
    "CAGR harga — laju pertumbuhan tahunan majemuk dari harga saham selama rentang histori yang kamu pilih (6 bulan / 1 tahun / 2 tahun). Ini konteks pergerakan harga, bukan pertumbuhan laba perusahaan.",
};
