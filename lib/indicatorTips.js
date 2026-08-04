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
  CAGR:
    "Compound Annual Growth Rate — laju pertumbuhan tahunan majemuk dari laba (atau revenue jika laba tidak tersedia). Dipakai untuk memperkirakan pertumbuhan bisnis ke depan, lalu di-clamp agar tidak terlalu ekstrem.",
  CAGR_HARGA:
    "CAGR harga — laju pertumbuhan tahunan majemuk dari harga saham selama rentang histori yang kamu pilih (6 bulan / 1 tahun / 2 tahun). Ini konteks pergerakan harga, bukan pertumbuhan laba perusahaan.",
};
