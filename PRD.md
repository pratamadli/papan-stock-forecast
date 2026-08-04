# Papan — Forecast Saham Pribadi

**Dokumentasi produk: PRD, tech stack, arsitektur, alur, dan logic**

---

## 1. Ringkasan Produk

**Papan** adalah web app personal untuk memantau dan forecast saham —
IDX (Indonesia) dan US — dengan sinyal BUY/SELL/HOLD berbasis indikator
teknikal + proyeksi tren statistik, valuasi fundamental (harga wajar),
jurnal posisi beli→cek→jual, plus opsi model machine learning
(XGBoost) yang jalan lokal untuk perbandingan yang lebih advance.

Dibangun untuk pemakaian pribadi (bukan produk komersial/multi-user),
di-deploy ke Vercel untuk versi utama, dengan tambahan opsional yang
sengaja **tidak** di-deploy karena keterbatasan environment serverless.

---

## 2. Problem Statement & Goals

**Masalah**: Butuh cara cepat buat cek "gimana kondisi saham ini sekarang,
dan kira-kira harus beli/jual/tahan?" tanpa buka banyak tab/tools
berbeda, dan tanpa harus manual hitung indikator sendiri. Setelah beli,
juga perlu catatan kapan cek ulang dan kapan pertimbangkan jual.

**Goals:**
- Input cepat (ticker + bursa), langsung dapat forecast & rekomendasi
- Sumber data gratis, tanpa perlu API key atau langganan
- Bisa pantau beberapa saham sekaligus (watchlist)
- Catat posisi beli (tanggal/waktu/harga) + saran cek ulang & jual
- Transparan — setiap rekomendasi ada alasannya, bukan black box;
  istilah indikator punya tooltip penjelasan
- Mata uang jelas: IDX = Rupiah (`Rp`), US = USD (`$`)
- Ruang buat eksperimen metode forecasting lebih canggih tanpa harus
  bongkar app utama

**Non-goals:**
- Bukan nasihat keuangan / bukan alat trading otomatis (tidak ada
  eksekusi order)
- Bukan multi-user / tidak ada sistem akun & autentikasi
- Bukan real-time tick-by-tick (data delay beberapa menit dari Yahoo
  Finance sudah cukup untuk swing/harian, bukan buat scalping)

---

## 3. Target Pengguna

Satu pengguna: pemilik app ini sendiri, untuk keputusan personal
investasi saham IDX & US. Bukan produk yang didesain untuk dipakai
publik/banyak orang sekaligus.

---

## 4. Fitur

| Fitur | Status | Keterangan |
|---|---|---|
| Cari & forecast satu ticker | ✅ | IDX (auto suffix `.JK`) & US |
| Autocomplete ticker | ✅ | Via Yahoo Finance search endpoint |
| Chart harga + SMA20/50 + proyeksi tren | ✅ | SVG custom, tanpa library chart eksternal |
| Legend warna garis chart | ✅ | Close, SMA20, SMA50, proyeksi ~10h, pembatas hari ini |
| Hover nilai di chart | ✅ | Crosshair + tooltip tanggal/close/SMA/proyeksi (mouse & touch) |
| Sinyal BUY/SELL/HOLD + alasan | ✅ | Rule-based, skor dari 4 indikator |
| Tooltip penjelasan indikator | ✅ | SMA20, SMA50, RSI14, MACD, CAGR |
| Watchlist multi-ticker | ✅ | Disimpan di `localStorage`, personal per-device |
| Jurnal posisi beli → cek → jual | ✅ | Catat beli, saran cek ~10 hari, saran jual, P&L |
| Valuasi fundamental + harga wajar | ✅ | CAGR, MoS, tabel proyeksi + keterangan per tahun |
| Format mata uang per bursa | ✅ | IDX → `Rp`, US → `$` |
| Forecast lanjutan (XGBoost) | ✅ (lokal only) | Servis Python terpisah, opsional |
| Backtest walk-forward | ✅ (lokal only) | Bandingkan XGBoost vs baseline SMA |
| Syariah screener | ✅ | Cek status DES/ISSI dari referensi lokal (bukan live scraping) |
| Crypto sebagai market ketiga | ❌ (backlog) | MVP teknikal-only direncanakan di §13; belum diimplementasikan |
| Live data resmi BEI | ❌ | Nggak ada API publik gratis dari BEI, lihat §9 |

---

## 5. Tech Stack

**App utama (deploy ke Vercel):**
- **Framework**: Next.js 14 (App Router), React 18
- **Styling**: Tailwind CSS, custom design token ("papan bursa" theme —
  navy/gold/mono, bukan default Tailwind)
- **Font**: Fraunces (display), IBM Plex Mono (data/angka), Inter (body)
- **Data source**: Yahoo Finance public chart & search endpoints (tanpa
  API key), dipanggil dari API route Next.js (server-side, hindari CORS)
- **State**: React state + `localStorage` untuk watchlist & jurnal posisi
  (tanpa database)
- **Chart**: SVG custom di `PriceChart.js` (bukan recharts/chart.js) —
  ringan, styling penuh terkontrol; termasuk **legend** warna garis dan
  **hover/touch** (crosshair + tooltip nilai per tanggal)

**Servis tambahan (lokal only, tidak di-deploy):**
- **Framework**: FastAPI (Python)
- **Model**: XGBoost (`XGBClassifier`)
- **Data**: Yahoo Finance public chart API (langsung via HTTPS + User-Agent),
  sama seperti app utama — bukan crumb flow `yfinance` ke `fc.yahoo.com`
  (sering gagal SSL di laptop kantor). `truststore` memakai sertifikat
  OS macOS. Paket `yfinance` masih di `requirements.txt` tapi fetch
  histori utama lewat `data.py` custom.
- **ML utils**: pandas, numpy, scikit-learn (metrics), joblib (persist model)
- **Python**: disarankan 3.11–3.12 (venv); Python 3.14 terlalu baru untuk
  pin dependency saat ini

**Hosting**: Vercel (app utama, gratis untuk pemakaian personal)

---

## 6. Arsitektur & Alur Data

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React UI)                       │
│  - Form cari ticker + pilih bursa/rentang                    │
│  - Watchlist + jurnal posisi (baca/tulis localStorage)       │
│  - Render chart, signal board, fundamental, advanced panel   │
└───────────────┬───────────────────────────────────────────────┘
                │ fetch /api/stock?symbol=...&market=...
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Route (server, Vercel)               │
│  1. fetchHistory()   → Yahoo Finance chart endpoint            │
│  2. buildSignal()    → hitung SMA/RSI/MACD/Holt's, skor sinyal │
│  3. fundamental + syariah                                      │
│  4. fetchAdvancedSignal() → coba panggil localhost:8000        │
│     (silent fail kalau nggak ada — normal di Vercel)           │
│  5. Gabung semua → response JSON ke browser                    │
└───────────────┬─────────────────────────────┬──────────────────┘
                │ (selalu)                     │ (opsional, lokal saja)
                ▼                               ▼
      Yahoo Finance API                 Python/FastAPI service
      (query1/query2.finance             (localhost:8000)
       .yahoo.com)                       - fetch chart API (+ truststore)
                                          - build features
                                          - train/load XGBoost
                                          - predict + backtest
```

**Poin penting**: app utama tidak pernah *bergantung* pada servis Python.
Kalau servis lokal itu mati/nggak dijalanin, `advanced` di response API
cuma jadi `null`, dan panel "XGBoost (local)" di UI otomatis nggak muncul.
Ini yang bikin app tetap 100% jalan normal saat di-deploy ke Vercel.

**Dua port saat develop lokal:**
- `http://localhost:3000` — UI + forecast utama (wajib dipakai user)
- `http://localhost:8000` — mesin hitung XGBoost (opsional); dipanggil
  server-side dari Next.js, bukan dibuka langsung oleh user

---

## 7. Logic Forecast — Sinyal Utama (Rule-Based)

File: `lib/forecast.js`

### 7.1 Proyeksi tren harga — Holt's Linear Trend Method

Double exponential smoothing: pisahin harga jadi **level** (harga halus
saat ini) dan **trend** (kemiringan arah), di-update tiap hari:

```
level_t = α × harga_t + (1-α) × (level_(t-1) + trend_(t-1))
trend_t = β × (level_t - level_(t-1)) + (1-β) × trend_(t-1)
```

Dengan α = 0.3 (bobot level), β = 0.15 (bobot trend). Forecast hari
ke-*h* ke depan = `level + h × trend`. Ini yang gambar garis putus-putus
hijau di chart (default proyeksi 10 hari).

**Horizon baca UI:**
- Sinyal BUY/SELL/HOLD + garis proyeksi chart → ~**10 hari** bursa
- Panel XGBoost (lokal) → arah naik/turun ~**5 hari**
- Valuasi fundamental → proyeksi **tahunan** (bukan harian)
- Form "Rentang" (6mo/1y/2y) hanya mengatur panjang **histori**, bukan
  panjang prediksi

### 7.1.1 Chart UI — legend & hover (`components/PriceChart.js`)

Garis di chart memakai warna tetap; legend di atas SVG menjelaskan arti
setiap garis:

| Warna | Gaya | Arti |
|---|---|---|
| `#E8E6DC` (putih krem) | solid tebal | Harga close historis |
| `#D4A94A` (emas) | solid tipis | SMA20 |
| `#8B96AE` (abu) | solid tipis | SMA50 |
| `#4FAE7A` (hijau) | putus-putus | Proyeksi Holt ~10 hari |
| Emas vertikal putus | — | Pembatas "hari ini" vs zona forecast |

**Hover / touch**: pointer di area plot menampilkan crosshair vertikal +
tooltip berisi tanggal (atau `+Nh proyeksi`), nilai close, SMA20, SMA50;
di zona forecast hanya nilai proyeksi. Tidak memakai library chart
eksternal — hitung index dari posisi X terhadap `totalPoints`.

### 7.2 Sinyal BUY/SELL/HOLD — skor gabungan 4 indikator

| Indikator | Bullish (+skor) | Bearish (−skor) |
|---|---|---|
| SMA20 vs SMA50 | SMA20 > SMA50 → +1 | SMA20 < SMA50 → −1 |
| RSI(14) | <30 oversold → +1.2 | >70 overbought → −1.2 |
| MACD histogram | golden cross → +1.3 | death cross → −1.3 |
| Arah proyeksi Holt's | naik >1% (10 hari) → +1 | turun >1% → −1 |

**Threshold aksi**: skor ≥ 1.5 → **BUY**, skor ≤ −1.5 → **SELL**, di
antaranya → **HOLD**. Tiap alasan yang berkontribusi ke skor ditampilkan
sebagai teks di UI (bukan cuma angka), biar transparan kenapa sinyalnya
begitu.

UI menampilkan nilai SMA20, SMA50, RSI14, dan MACD histogram di papan
sinyal. Penjelasan istilah ada di tooltip (`components/InfoTip.js` +
`lib/indicatorTips.js`) untuk SMA20, SMA50, RSI14, MACD, dan CAGR.

### 7.3 Syariah Screener (`lib/syariah.js`)

Motivasi: memastikan proses investasi tetap dalam koridor halal —
saham secara umum diperbolehkan (kepemilikan bisnis riil), tapi status
syariah tiap emiten tergantung sektor usaha & rasio keuangan tertentu.

- **Sumber**: OJK menerbitkan Daftar Efek Syariah (DES) 2x setahun (Mei
  & November) sebagai dokumen, bukan API. IDX juga punya halaman
  konstituen JII/JII70/ISSI. Karena keduanya bukan endpoint publik yang
  bisa dipanggil live, app ini **tidak** melakukan scraping otomatis
  (konsisten dengan keputusan sebelumnya soal endpoint tak resmi IDX).
- **Implementasi**: referensi lokal manual di `data/syariah-list.json`,
  berisi ticker yang sudah dikonfirmasi masuk (`confirmed_syariah`) atau
  baru saja dikeluarkan (`confirmed_removed`) dari daftar syariah, dengan
  metadata `as_of` dan sumber. Ticker yang belum ada di file ini
  ditandai **"unknown"**, bukan ditebak sebagai syariah/non-syariah.
- **Update**: manual, mengikuti jadwal rilis DES OJK — instruksinya ada
  di `meta.how_to_update` dalam file JSON itu sendiri.
- **Cakupan**: cuma berlaku untuk saham IDX (kriteria DES/OJK). Saham US
  ditandai "not-applicable" karena standar syariahnya beda (mis. AAOIFI
  atau Dow Jones Islamic Market Index), belum diimplementasikan.

### 7.4 Valuasi Fundamental (`lib/fundamentalValuation.js`)

Motivasi: melengkapi sinyal teknikal dengan sudut pandang fundamental/
value investing, supaya keputusan beli/jual mempertimbangkan kondisi
bisnis juga — bukan cuma pola harga (relevan juga untuk menjaga proses
investasi tetap "investasi", bukan spekulasi murni).

**Catatan penting**: ini bukan implementasi metode proprietary siapapun
(termasuk bukan "FCDS-T" yang sempat dibahas) — murni konsep keuangan
terbuka: CAGR (Compound Annual Growth Rate) dan Margin of Safety ala
Benjamin Graham.

- **Growth rate**: CAGR laba historis (dari data `earnings` Yahoo
  Finance, ~4 tahun terakhir); fallback ke CAGR revenue kalau laba
  negatif/tidak tersedia. Di-clamp ke rentang -30% s.d. +60% per tahun
  supaya nggak over-ekstrapolasi dari data historis yang noisy.
- **Proyeksi harga**: `EPS sekarang × (1+CAGR)^tahun × P/E sekarang` —
  asumsi sederhana bahwa pasar akan terus menghargai bisnis ini dengan
  multiple yang sama seperti sekarang (konservatif, tidak mengasumsikan
  multiple expansion).
- **Harga wajar per horizon**: tiap tahun proyeksi (1–5) punya
  `fairValueNow` = proyeksi harga tahun itu didiskon balik ke hari ini
  (required return 15%), plus kolom **Keterangan** (lebih murah / lebih
  mahal / relatif dekat vs harga pasar).
- **Intrinsic value & Margin of Safety**: pakai horizon akhir (tahun ke-N);
  Margin of Safety = seberapa "diskon" harga sekarang dibanding
  intrinsic value hasil proyeksi ini.
- **Dividend yield & CAGR harga**: ditampilkan sebagai konteks tambahan,
  bukan bagian dari kalkulasi Margin of Safety.
- **Keterbatasan yang disebutkan di UI**: proyeksi ini asumsi kasar
  (P/E dianggap tetap, growth rate historis dianggap berlanjut) — bukan
  valuasi presisi ala equity research profesional.

### 7.5 Jurnal Posisi Beli → Cek → Jual

File: `lib/usePositions.js`, `lib/positionAdvice.js`,
`components/PositionPanel.js`

Jurnal pribadi (bukan broker). User mencatat beli setelah forecast;
app menyimpan di `localStorage` key `papan.positions.v1`.

**Data per posisi:**
- `id`, `symbol`, `market`, `currency` (`IDR` kalau IDX, `USD` kalau US)
- `buyAt`, `buyPrice`, `lots` (opsional)
- Snapshot: `checkAt` (= beli + 10 hari kalender), `targetPrice`
  (proyeksi Holt hari ke-10 saat dicatat)
- Status `open` | `closed`; kalau closed: `sellAt`, `sellPrice`

**Logic saran:**

| Info | Cara hitung |
|---|---|
| Cek lagi | `checkAt`; status belum / hari ini / lewat |
| Target jual | `targetPrice` vs harga sekarang |
| Saran aksi | sinyal live SELL → pertimbangkan jual; harga ≥ target → target tercapai; sebelum `checkAt` → tahan, cek lagi pada … |
| P&L | `(hargaSekarang − buyPrice) / buyPrice` (+ nominal × lots) |

Bukan eksekusi order. Saran cek/jual adalah panduan; +10 hari adalah
hari kalender sederhana (bukan kalender libur bursa resmi).

---

## 8. Logic Forecast Lanjutan — XGBoost (Lokal)

Folder: `local-forecast/`

### 8.1 Definisi label (target prediksi)

Bukan prediksi harga persis, tapi **arah**: apakah harga close akan
lebih tinggi `horizon` hari bursa ke depan (default 5) dibanding
sekarang? → klasifikasi biner (1 = naik, 0 = tidak), lebih jujur dan
lebih *learnable* daripada nebak harga eksak.

### 8.2 Fitur yang dipakai (`features.py`)

- Return 1/3/5/10 hari
- Jarak harga ke SMA20 & SMA50 (relatif, `%`)
- RSI(14)
- MACD histogram
- Volatilitas 10 hari (std return harian)
- Perubahan volume 5 hari

### 8.3 Model & training (`model.py`)

- `XGBClassifier`, `max_depth=3` (dangkal, biar nggak overfit ke data
  harian yang jumlahnya terbatas per saham)
- Split kronologis 80/20 (train/test) — **bukan random split**, karena
  data time series tidak boleh "bocor" info masa depan ke training
- Model disimpan per ticker+horizon (`models/{symbol}_h{horizon}.joblib`)
  via `joblib`, di-cache supaya nggak retraining tiap request

### 8.4 Baseline pembanding

Aturan sederhana: "prediksi NAIK kalau harga sekarang di atas SMA20-nya
sendiri" — sengaja dibuat semirip mungkin dengan logic SMA-crossover di
sinyal utama JS, biar perbandingannya adil (apple-to-apple, bukan
XGBoost vs strawman).

### 8.5 Walk-forward backtest (`backtest.py`)

Expanding window, default 5 fold — model di-retrain di tiap fold pakai
data sampai titik tertentu, lalu dites di periode berikutnya yang belum
pernah dilihat. Ini yang dipakai buat jawab pertanyaan jujur: "apakah
XGBoost beneran lebih akurat dari baseline SMA untuk ticker ini, atau
cuma kebetulan bagus di satu split doang?"

### 8.6 Endpoint (`app.py`, FastAPI)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/predict` | GET | Prediksi arah + probabilitas + metrik backtest single-split |
| `/train` | POST | Paksa retrain model untuk ticker+horizon tertentu |
| `/backtest` | GET | Walk-forward validation multi-fold |
| `/health` | GET | Cek servis nyala |

### 8.7 Fetch data lokal (`data.py`)

Histori OHLCV diambil dari Yahoo chart API
(`query1`/`query2.finance.yahoo.com`) dengan User-Agent browser +
`truststore` (OS cert store). Ini menghindari error umum di macOS/
jaringan kantor: `SSLCertVerificationError` saat `yfinance` hit
`fc.yahoo.com`, yang lalu salah dilaporkan sebagai "possibly delisted".

---

## 9. Sumber Data

- **Utama (deployed)**: Yahoo Finance public chart & search endpoint,
  tanpa API key, dipanggil server-side dari Next.js API route. Saham
  IDX otomatis di-suffix `.JK`. Mata uang response dipaksa dari market:
  IDX → `IDR`, US → `USD`.
- **Lokal (XGBoost service)**: chart API Yahoo yang sama (periode lebih
  panjang, ~3–5 tahun), bukan crumb flow `yfinance`.
- **BEI resmi**: tidak dipakai. BEI menjual data real-time lewat produk
  B2B ("Market Data BEI") yang berbayar dan ditujukan untuk
  broker/institusi, bukan API publik gratis untuk developer perorangan.
  Opsi lain (provider resell seperti Invezgo/GOAPI, atau endpoint tak
  resmi situs idx.co.id) sempat dibahas tapi tidak diimplementasikan —
  lihat catatan di README utama.

---

## 10. Struktur Folder

```
stock-forecast/
├── app/
│   ├── page.js                 # UI utama (search, chart, signal, watchlist, posisi)
│   ├── layout.js                # Root layout + font
│   ├── globals.css
│   └── api/
│       ├── stock/route.js       # Endpoint utama: history + sinyal + fundamental + syariah + advanced
│       └── search/route.js      # Autocomplete ticker
├── components/
│   ├── TickerTape.js             # Marquee harga berjalan
│   ├── PriceChart.js             # Chart SVG + legend warna + hover/tooltip nilai
│   ├── SignalBoard.js            # Papan BUY/SELL/HOLD + indikator + tooltip
│   ├── FundamentalPanel.js       # Panel CAGR/harga wajar/Margin of Safety
│   ├── PositionPanel.js          # Form catat beli + daftar posisi + saran cek/jual
│   ├── InfoTip.js                # Tooltip penjelasan istilah
│   ├── SyariahBadge.js           # Badge status syariah
│   ├── AdvancedSignal.js         # Panel XGBoost (muncul kalau servis lokal nyala)
│   └── Watchlist.js              # Daftar saham dipantau
├── lib/
│   ├── yahoo.js                  # Fetch data + fundamental + search dari Yahoo Finance
│   ├── forecast.js               # Holt's trend + indikator + skor sinyal
│   ├── fundamentalValuation.js   # CAGR + harga wajar per tahun + Margin of Safety
│   ├── positionAdvice.js         # Logic cek lagi / saran jual / P&L
│   ├── indicatorTips.js          # Teks tooltip SMA/RSI/MACD/CAGR
│   ├── syariah.js                # Cek status syariah dari referensi lokal
│   ├── localForecast.js          # Client buat panggil servis Python (best-effort)
│   ├── useWatchlist.js           # Hook localStorage watchlist
│   └── usePositions.js           # Hook localStorage jurnal posisi
├── data/
│   └── syariah-list.json         # Referensi syariah manual (update sesuai jadwal DES OJK)
└── local-forecast/                # Servis Python, TIDAK di-deploy
    ├── app.py                     # FastAPI endpoints (+ truststore)
    ├── data.py                    # Fetch Yahoo chart API (+ truststore)
    ├── features.py                # Feature engineering
    ├── model.py                   # Training/predict XGBoost
    ├── backtest.py                # Walk-forward validation
    └── models/                    # Model tersimpan (gitignored)
```

---

## 11. Cara Menjalankan

**App utama:**
```bash
npm install
npm run dev        # http://localhost:3000
```

**Servis lanjutan (opsional)** — Python 3.11/3.12 + venv disarankan:
```bash
cd local-forecast
# contoh Homebrew Python 3.12:
# /opt/homebrew/opt/python@3.12/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000   # http://localhost:8000
```

Di macOS, perintahnya sering `pip3` / `python3` kalau belum pakai venv.
Setelah venv aktif, `pip` tersedia di dalam venv.

**Deploy:** push ke GitHub → import di vercel.com/new → deploy (tanpa
env var wajib). Servis `local-forecast/` tidak ikut di-deploy.

---

## 12. Batasan & Disclaimer

- Bukan nasihat keuangan — semua forecast murni hasil olah statistik
  atas data historis, bukan jaminan pergerakan harga di masa depan.
- Data ada delay (bukan real-time tick), cukup untuk keputusan harian/
  swing, tidak cocok untuk day-trading berkecepatan tinggi.
- Akurasi arah harga jangka pendek secara inheren terbatas — pasar
  saham cenderung *semi-efficient*; akurasi di atas ~50-55% pada data
  out-of-sample sudah dianggap hasil yang baik, bukan bukti model
  "sempurna".
- Endpoint Yahoo Finance yang dipakai tidak didokumentasikan resmi
  untuk pihak ketiga — dipakai luas dan cukup stabil untuk pemakaian
  personal, tapi bisa berubah sewaktu-waktu tanpa pemberitahuan.
- Status syariah berbasis referensi lokal yang sengaja dibuat terbatas
  (bukan Daftar Efek Syariah lengkap) — ticker yang belum ada di data
  ditandai "belum terverifikasi", bukan ditebak. Selalu cek ke OJK/IDX
  langsung untuk kepastian sebelum dijadikan dasar keputusan.
- Valuasi fundamental adalah proyeksi kasar berbasis asumsi sederhana
  (P/E tetap, growth rate historis berlanjut) — bukan valuasi presisi,
  dan tidak memperhitungkan faktor kualitatif bisnis (manajemen,
  kompetisi, risiko sektor, dll).
- Jurnal posisi & watchlist hanya di browser (`localStorage`) — hapus
  data browser = hilang; tidak sinkron antar perangkat.
- Jadwal "cek lagi" (+10 hari) memakai hari kalender, bukan kalender
  libur bursa resmi.

---

## 13. Ide Pengembangan Selanjutnya

- Bollinger Bands sebagai indikator tambahan di sinyal utama
- Ganti/tambah baseline forecast statistik (ARIMA/Prophet) sebagai
  pembanding lain di sisi lokal
- Ekspor histori watchlist + posisi + sinyal ke CSV
- Notifikasi (misal lewat cron lokal) kalau sinyal watchlist / posisi
  berubah (mis. jadi SELL atau lewat `checkAt`)
- Target jual / tanggal cek yang bisa di-override manual per posisi
- **Crypto (MVP teknikal-only, backlog)**: market ketiga `CRYPTO` via
  Yahoo (`BTC-USD`, dll.) — reuse sinyal teknikal/chart/posisi; **tanpa**
  valuasi fundamental (EPS/P/E tidak relevan); syariah `not-applicable`
  dengan catatan khusus; currency USD; disclaimer volatilitas. Jangan
  campur ke flow IDX/US tanpa selector eksplisit. Metrik on-chain /
  kalibrasi skor khusus crypto di luar scope MVP.
