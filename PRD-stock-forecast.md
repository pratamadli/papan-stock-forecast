# Papan — Forecast Saham Pribadi

**Dokumentasi produk: PRD, tech stack, arsitektur, alur, dan logic**

---

## 1. Ringkasan Produk

**Papan** adalah web app personal untuk memantau dan forecast saham
IDX (Indonesia) & US, plus crypto (teknikal-only) — dengan sinyal
BUY/SELL/HOLD berbasis indikator teknikal + proyeksi tren statistik,
valuasi fundamental untuk saham (harga wajar), jurnal posisi
beli→cek→jual, plus opsi model machine learning (XGBoost) lokal.

Dibangun untuk pemakaian pribadi (bukan produk komersial/multi-user),
di-deploy ke Vercel untuk versi utama, dengan tambahan opsional yang
sengaja **tidak** di-deploy karena keterbatasan environment serverless.

### 1.1 Identitas & konfigurasi proyek

| Item | Nilai |
|---|---|
| Nama produk | **Papan** |
| Repo / folder root | `papan-stock-forecast` |
| npm package name (`package.json`) | `papan-saham-forecast` |
| Proyek Vercel | `papan-stock-forecast` |
| Production URL | https://papan-stock-forecast.vercel.app/ |
| Production branch | `main` → production; `dev` (& lainnya) → preview |
| Versi app | `1.1.4` (`package.json`; footer `Papan v…`) |
| Framework | Next.js 14 (App Router), React 18 |
| Styling | Tailwind CSS + **shadcn/ui** — dark fintech glassmorphism (teal accent) |
| Config Next | `next.config.js` — `reactStrictMode: true` |
| Analytics | `@vercel/analytics` di `app/layout.js` |
| Favicon | `app/icon.svg` + `app/apple-icon.svg` (sparkles mark) |
| Env wajib (Vercel / production) | tidak ada |
| Env opsional (dev lokal) | `LOCAL_FORECAST_URL` (default `http://localhost:8000`) di `lib/localForecast.js` |
| Git ignore | `node_modules`, `.next`, `.vercel`, `.env*.local`, `.env*` |

Dokumen ini (`PRD.md`) dan `PRD-stock-forecast.md` isinya sama; yang kedua
disimpan sebagai salinan bernama repo untuk referensi cepat.

### 1.2 Riwayat versi (ringkas)

| Versi | Ringkasan |
|---|---|
| `1.0.0` | Rilis dasar IDX/US, watchlist, posisi, syariah, fundamental, XGBoost lokal |
| `1.1.0` | CRYPTO, toggle USD/IDR, sinyal selektif, kalender libur, CSV, override target |
| `1.1.1` | shadcn + dark glass UI, landing showcase, warna sinyal H/K/M, Analytics, favicon |
| `1.1.2` | Leaderboard Top 10 BELI/JUAL/TAHAN per market (universe curated) + ambang ±2.0 |
| `1.1.3` | Optimasi API: retry/timeout/cache Yahoo, `/api/quote`, abort fetch client, concurrency terbatas |
| `1.1.4` | Fix loop live quote posisi tersimpan dengan memoized open/closed positions |

Lihat **Version Update Log** di `README.md` untuk detail penuh.

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
- Mata uang jelas: IDX = Rupiah (`Rp`); US & CRYPTO = USD (`$`) dengan opsi tampilan Rupiah (kurs Yahoo USD/IDR)
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
| Cari & forecast satu ticker | ✅ | IDX (`.JK`), US, CRYPTO (`*-USD`) |
| Autocomplete ticker | ✅ | Via Yahoo Finance search endpoint |
| Chart harga + SMA20/50 + proyeksi tren | ✅ | SVG custom, tanpa library chart eksternal |
| Legend warna garis chart | ✅ | Close, SMA20, SMA50, proyeksi ~10h, pembatas hari ini |
| Hover nilai di chart | ✅ | Crosshair + tooltip tanggal/close/SMA/proyeksi (mouse & touch) |
| Sinyal BUY/SELL/HOLD + alasan | ✅ | Rezim-aware + filter volume/ATR; ambang lebih ketat |
| Keyakinan (confidence) sinyal | ✅ | Kesepakatan indikator × kekuatan skor vs ambang |
| Hit-rate backtest sinyal (deployed) | ✅ | Walk-forward BUY/SELL ~10h di `/api/stock` |
| Relative strength vs indeks | ✅ | `^JKSE` (IDX) / `SPY` (US), best-effort |
| Tooltip penjelasan indikator | ✅ | SMA/RSI/MACD/BB/rezim/volume/ATR/RS/hit-rate/CAGR |
| Watchlist multi-ticker | ✅ | Disimpan di `localStorage`, personal per-device |
| Ekspor CSV watchlist | ✅ | Snapshot harga + sinyal + syariah |
| Jurnal posisi beli → cek → jual | ✅ | Catat beli, saran cek ~10 hari bursa, saran jual, P&L |
| Live quote ringan | ✅ | `/api/quote` untuk watchlist/posisi; concurrency terbatas agar tidak membebani `/api/stock` |
| Override target jual / tanggal cek | ✅ | Saat catat beli atau edit kartu posisi |
| Kalender libur bursa (cek lagi) | ✅ | Weekend + libur IDX/US di `lib/marketCalendar.js` |
| Ekspor CSV posisi | ✅ | Jurnal + P&L + sinyal live + flag manual |
| Valuasi fundamental + harga wajar | ✅ | CAGR, MoS, tabel proyeksi + keterangan per tahun |
| Format mata uang per bursa | ✅ | IDX → `Rp`; US & CRYPTO → `$` (+ toggle tampilan Rp via kurs USD/IDR) |
| Crypto (teknikal-only) | ✅ | Market `CRYPTO`; tanpa fundamental; syariah N/A; cek 24/7 |
| Leaderboard Top 10 sinyal | ✅ | BELI/JUAL/TAHAN per IDX·US·CRYPTO; universe `signal-universe.json`; cache 15m |
| Landing showcase (UI) | ✅ | Chart preview, trust, security, vault — tanpa ubah fungsi |
| Warna sinyal BELI/TAHAN/JUAL | ✅ | Hijau / kuning (`board-hold`) / merah |
| UI shadcn + glassmorphism | ✅ | Card/Button/Badge/Input; tema dark fintech |
| Vercel Analytics | ✅ | Page views production via `@vercel/analytics` |
| Favicon app (bukan Vercel) | ✅ | Sparkles SVG di tab browser |
| Forecast lanjutan (XGBoost) | ✅ (lokal only) | Servis Python; di-skip untuk CRYPTO di API |
| Backtest walk-forward | ✅ (lokal only) | Bandingkan XGBoost vs baseline SMA |
| Syariah screener | ✅ | DES lokal untuk IDX; US/CRYPTO → not-applicable |
| Live data resmi BEI | ❌ | Nggak ada API publik gratis dari BEI, lihat §9 |

---

## 5. Tech Stack

**App utama (deploy ke Vercel):**
- **Framework**: Next.js 14 (App Router), React 18
- **Styling**: Tailwind CSS + **shadcn/ui** (`components/ui/*`, `lib/utils.js`,
  `components.json`) — dark fintech glassmorphism, aksen teal; token
  `board-*` (termasuk `board-hold` kuning untuk TAHAN)
- **Font**: Fraunces (display), IBM Plex Mono (data/angka), Inter (body)
- **Analytics**: `@vercel/analytics` (root layout)
- **Data source**: Yahoo Finance public chart & search endpoints (tanpa
  API key), dipanggil dari API route Next.js (server-side, hindari CORS);
  retry 3x, timeout per attempt, fallback `query1`→`query2`, cache pendek;
  kurs USD/IDR (`fetchUsdIdrRate`) untuk toggle tampilan Rupiah
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

**Hosting**: Vercel — proyek `papan-stock-forecast` (app utama, gratis
untuk pemakaian personal). Folder `.vercel` hasil `vercel link` tidak
di-commit (ada di `.gitignore`).

---

## 6. Arsitektur & Alur Data

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React UI)                       │
│  - Landing glass UI + form cari ticker / bursa / rentang     │
│  - Leaderboard Top 10 BELI/JUAL/TAHAN (SignalLeaders)        │
│  - Watchlist + jurnal posisi (baca/tulis localStorage)       │
│  - Render chart, signal board, fundamental, advanced panel   │
│  - Vercel Analytics (page views)                             │
└───────┬───────────────────────────────┬──────────────────────┘
        │ /api/stock                    │ /api/leaders?market=
        ▼                               ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│  stock/route.js          │  │  leaders/route.js              │
│  history + sinyal +      │  │  universe JSON → batch Yahoo   │
│  fundamental + syariah   │  │  buildSignal → top 10/action   │
│  + fx + advanced (lokal) │  │  cache ~15m (tanpa fund./XGB)  │
└───────────┬──────────────┘  └───────────────┬────────────────┘
            │                                 │
            └────────────────┬────────────────┘
                             ▼
      Yahoo Finance API              Python/FastAPI (opsional lokal)
      (query1/query2…)               localhost:8000 — XGBoost only
```

**Poin penting**: app utama tidak pernah *bergantung* pada servis Python.
Kalau servis lokal itu mati/nggak dijalanin, `advanced` di response API
cuma jadi `null`, dan panel "XGBoost (local)" di UI otomatis nggak muncul.
Ini yang bikin app tetap 100% jalan normal saat di-deploy ke Vercel.

**Endpoint ringan**: watchlist dan jurnal posisi memakai `/api/quote`
untuk harga+sinyal ringkas. Endpoint forecast penuh `/api/stock` hanya
dipakai saat user benar-benar membuka detail forecast satu ticker.

**Dua port saat develop lokal:**
- `http://localhost:3000` — UI + forecast utama (wajib dipakai user)
- `http://localhost:8000` — mesin hitung XGBoost (opsional); dipanggil
  server-side dari Next.js, bukan dibuka langsung oleh user.
  Override URL lewat env `LOCAL_FORECAST_URL` bila port/host beda.

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
- Jadwal "cek lagi" posisi → default **10 hari bursa** (bukan kalender)
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

### 7.2 Sinyal BUY/SELL/HOLD — selektif, rezim-aware (deployable)

File: `lib/forecast.js`. Input: `closes` + `highs`/`lows`/`volumes` +
opsional `indexCloses` (benchmark).

**Rezim** (`|SMA20−SMA50| / ATR14`):
- `trending` (≥2) → bobot SMA/MACD/Holt/RS naik; RSI/BB turun
- `sideways` (≤1) → bobot RSI/BB naik; tren turun
- `mixed` → bobot seimbang

**Komponen skor** (bobot tergantung rezim, lihat `WEIGHTS` di kode):
SMA cross, RSI, MACD (cross atau konfirmasi ≥2 bar), Holt (live) /
slope SMA20 (backtest cepat), Bollinger %B, relative strength vs
indeks (`^JKSE` / `SPY`).

**Filter & ambang:**
- Ambang default **±2.0** (seimbang; dulu ±2.5 ketat / ±1.5 longgar); **±2.75** jika ATR% > 4.5%
- Volume &lt; 85% SMA20 volume → paksa **HOLD** meski skor tembus ambang
- Confidence = 0.55×agreement + 0.45×strength (bukan probabilitas harga)

**Backtest sinyal (ikut deploy):** `backtestSignal()` walk-forward di
histori ticker yang sama; BUY hit jika `close[i+10] > close[i]`, SELL
sebaliknya. Hasil di `signal.backtest` (hitRate, buy/sell breakdown,
holdShare). Ditampilkan di `SignalBoard`.

UI menampilkan rezim, keyakinan, hit-rate, volume ratio, ATR%, benchmark,
plus indikator klasik. Tooltip di `lib/indicatorTips.js`.

### 7.2.1 Leaderboard sinyal (`/api/leaders` + `SignalLeaders`)

Papan perbandingan cepat antar ticker likuid — **bukan** scan seluruh
bursa (batasan Yahoo rate-limit + timeout Vercel).

| Aspek | Spesifikasi |
|---|---|
| Universe | `data/signal-universe.json` — array `IDX` / `US` / `CRYPTO` (~30–40 likuid) |
| Endpoint | `GET /api/leaders?market=IDX\|US\|CRYPTO&range=6mo` (`refresh=1` bypass cache) |
| Scoring | `fetchHistory` + `buildSignal` (sama dengan forecast); 1× benchmark RS per market |
| Parallel | Batch concurrency 4; `maxDuration` 60s |
| Cache | In-memory per `market\|range`, TTL ~15 menit |
| BELI | Top 10 `action===BUY` by skor ↓ |
| JUAL | Top 10 `action===SELL` by skor ↑ (paling negatif dulu) |
| TAHAN | Top 10 `action===HOLD` by `\|skor\|` ↓ (mendekati ambang) |
| UI | Tab market + 3 tabel; klik symbol → `runForecast` di `page.js` |
| Catatan UI | Menampilkan `scanned/universeSize`; jujur “bukan seluruh bursa” |

Edit universe = edit JSON lalu deploy/restart; tidak perlu DB.

### 7.2.2 Optimasi API & resilience

- `lib/yahoo.js` membatasi call Yahoo dengan retry 3 attempt di host utama,
  timeout per attempt, fallback ke host kedua, dan cache response sukses
  singkat agar panel yang meminta data sama tidak memukul Yahoo berulang.
- `/api/stock` dipakai untuk forecast detail penuh; benchmark, fundamental,
  FX, dan advanced signal dijalankan paralel setelah history utama berhasil.
- `/api/quote` dipakai untuk watchlist dan posisi tersimpan, hanya mengirim
  harga terakhir, sinyal teknikal, currency, dan syariah. Ini mencegah
  background refresh memanggil `/api/stock` berkali-kali.
- Daftar posisi terbuka/distutup di `PositionPanel` di-memoize supaya
  update `quotes` tidak membuat array posisi baru dan memicu fetch ulang
  tanpa perubahan data posisi.
- Fetch client memakai `AbortController` + stale guard untuk search,
  forecast, leaderboard, watchlist, dan posisi. Request yang sudah tidak
  relevan tidak menimpa state terbaru.
- Di Vercel, `fetchAdvancedSignal` langsung dilewati jika `LOCAL_FORECAST_URL`
  tidak di-set, karena servis XGBoost memang lokal-only.

### 7.3 Syariah Screener (`lib/syariah.js`)

Motivasi: memastikan proses investasi tetap dalam koridor halal —
saham secara umum diperbolehkan (kepemilikan bisnis riil), tapi status
syariah tiap emiten tergantung sektor usaha & rasio keuangan tertentu.

- **Sumber**: OJK menerbitkan Daftar Efek Syariah (DES) 2x setahun (Mei
  & November) sebagai dokumen, bukan API. IDX juga punya halaman
  konstituen JII/JII70/ISSI. Karena keduanya bukan endpoint publik yang
  bisa dipanggil live, app ini **tidak** melakukan scraping otomatis
  (konsisten dengan keputusan sebelumnya soal endpoint tak resmi IDX).
- **Implementasi**: referensi lokal manual di `data/syariah-list.json`.
  Periode saat ini: **2 Juni – 30 November 2026** (OJK
  `KEP-21/D.04/2026`). `confirmed_syariah` diisi 30 konstituen JII;
  `confirmed_removed` diisi ticker yang keluar dari JII pada review itu
  (ASII, BRPT, DSSA, INCO, ISAT, PANI, PGEO). Ticker yang belum ada di
  file ini ditandai **"unknown"**, bukan ditebak sebagai
  syariah/non-syariah.
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
- Snapshot: `checkAt` (default = beli + 10 **hari bursa** via
  `lib/marketCalendar.js`), `checkAtManual`, `targetPrice` (default
  proyeksi Holt hari ke-10), `targetManual`
- Status `open` | `closed`; kalau closed: `sellAt`, `sellPrice`

**Override:** user boleh ganti target jual dan/atau tanggal cek saat
catat beli (checkbox override) atau lewat tombol "Ubah target / cek"
di kartu posisi terbuka. "Reset cek" mengembalikan `checkAt` ke
+10 hari bursa dari `buyAt`.

**Logic saran:**

| Info | Cara hitung |
|---|---|
| Cek lagi | `checkAt`; status belum / hari ini / lewat; label tampilkan · manual kalau di-override |
| Target jual | `targetPrice` vs harga sekarang |
| Saran aksi | sinyal live SELL → pertimbangkan jual; harga ≥ target → target tercapai; sebelum `checkAt` → tahan, cek lagi pada … |
| P&L | `(hargaSekarang − buyPrice) / buyPrice` (+ nominal × lots) |

Bukan eksekusi order. Saran cek/jual adalah panduan. Default +10 hari
memakai hari bursa (weekend + libur IDX/US di `marketCalendar.js`);
daftar libur dikurasi manual untuk 2025–2027 dan perlu di-update
bergantung pengumuman BEI/NYSE.

### 7.6 Ekspor CSV

File: `lib/exportCsv.js`

- **Watchlist**: tombol di `Watchlist.js` — kolom symbol, market, price,
  currency, signal, score, syariah, exportedAt.
- **Posisi**: tombol di `PositionPanel.js` — kolom jurnal lengkap plus
  currentPrice, signal, pnlPct, pnlNominal, flag `checkAtManual` /
  `targetManual`.
- File diunduh di browser (BOM UTF-8); data tetap hanya di `localStorage`
  sampai user ekspor.

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
  IDX otomatis di-suffix `.JK`; crypto → `*-USD`. Mata uang response
  dipaksa dari market: IDX → `IDR`, US & CRYPTO → `USD`. Toggle tampilan
  Rupiah memakai kurs spot Yahoo (`IDR=X` / `USDIDR=X`) — bukan pair BIDR.
  Wrapper Yahoo memakai retry, timeout, fallback host, dan cache pendek
  untuk menjaga volume request tetap rendah.
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
papan-stock-forecast/
├── app/
│   ├── page.js                 # UI utama (hero/landing, search, chart, signal, …)
│   ├── layout.js                # Root layout + font + Analytics + footer versi
│   ├── globals.css              # Tema glass + token shadcn CSS variables
│   ├── icon.svg / apple-icon.svg # Favicon sparkles (tab browser)
│   └── api/
│       ├── stock/route.js       # history + sinyal + fundamental + syariah + fx + advanced
│       ├── quote/route.js       # harga + sinyal ringan untuk watchlist/posisi
│       ├── leaders/route.js     # Top 10 BELI/JUAL/TAHAN per market (batched)
│       └── search/route.js      # Autocomplete ticker
├── components/
│   ├── ui/                       # shadcn: button, card, badge, input, separator
│   ├── SignalLeaders.js          # Tabel leaderboard sinyal + tab market
│   ├── LandingShowcase.js        # Landing trust / security / vault (UI only)
│   ├── TickerTape.js             # Marquee harga berjalan
│   ├── PriceChart.js             # Chart SVG + legend warna + hover/tooltip nilai
│   ├── SignalBoard.js            # Papan BELI/TAHAN/JUAL (hijau/kuning/merah)
│   ├── FundamentalPanel.js       # Panel CAGR/harga wajar/Margin of Safety
│   ├── PositionPanel.js          # Form catat beli + override + CSV + saran cek/jual
│   ├── InfoTip.js                # Tooltip penjelasan istilah
│   ├── SyariahBadge.js           # Badge status syariah
│   ├── AdvancedSignal.js         # Panel XGBoost (muncul kalau servis lokal nyala)
│   └── Watchlist.js              # Daftar saham dipantau + ekspor CSV
├── lib/
│   ├── utils.js                  # cn() untuk shadcn/tailwind-merge
│   ├── displayMoney.js           # Konversi tampilan USD ↔ IDR (client)
│   ├── yahoo.js                  # Fetch data + fundamental + search + USDIDR
│   ├── forecast.js               # Rezim/volume/ATR/RS + skor + backtestSignal
│   ├── fundamentalValuation.js   # CAGR + harga wajar per tahun + Margin of Safety
│   ├── positionAdvice.js         # Logic cek lagi / saran jual / P&L
│   ├── marketCalendar.js         # Hari bursa IDX/US (weekend + libur)
│   ├── exportCsv.js              # Helper unduh CSV watchlist & posisi
│   ├── indicatorTips.js          # Teks tooltip SMA/RSI/MACD/BB/CAGR
│   ├── syariah.js                # Cek status syariah dari referensi lokal
│   ├── localForecast.js          # Client buat panggil servis Python (best-effort)
│   ├── useWatchlist.js           # Hook localStorage watchlist
│   └── usePositions.js           # Hook localStorage jurnal posisi (+ update override)
├── components.json               # Config shadcn/ui
├── data/
│   ├── signal-universe.json      # Universe curated untuk leaderboard
│   └── syariah-list.json         # Referensi JII/DES manual (KEP-21/D.04/2026)
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

**Deploy:** push repo `papan-stock-forecast` ke GitHub → import /
`vercel link` ke proyek Vercel `papan-stock-forecast` → deploy (tanpa
env var wajib; jangan set `LOCAL_FORECAST_URL` di production). Servis
`local-forecast/` tidak ikut di-deploy.

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
- Jadwal "cek lagi" default memakai hari bursa (weekend + libur
  terkurasi), tapi daftar libur tidak selalu 100% sinkron dengan
  pengumuman resmi BEI/NYSE — override manual tersedia.

---

## 13. Ide Pengembangan Selanjutnya

- Kalibrasi ulang `WEIGHTS` / ambang dari agregat hit-rate banyak ticker
  (saat ini prior hardcoded di `forecast.js`)
- Ganti/tambah baseline forecast statistik (ARIMA/Prophet) sebagai
  pembanding lain di sisi lokal (bukan prioritas deploy)
- Notifikasi (misal lewat cron lokal) kalau sinyal watchlist / posisi
  berubah (mis. jadi SELL atau lewat `checkAt`)
- Perbarui daftar libur `marketCalendar.js` tiap tahun dari kalender
  resmi BEI / NYSE
- Metrik on-chain / kalibrasi skor khusus crypto (di luar MVP teknikal
  yang sudah ada)
- Autocomplete crypto yang lebih lengkap (whitelist ticker populer) jika
  Yahoo search sparsely
