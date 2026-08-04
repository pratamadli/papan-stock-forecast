# Papan — Forecast Saham Pribadi

App web sederhana untuk forecast harga saham (IDX & US) dan crypto
(BTC-USD, ETH-USD, …) pakai data historis dari Yahoo Finance (gratis, tanpa
API key), lalu kasih sinyal BUY/SELL/HOLD.

## Identitas & konfigurasi

| Item | Nilai |
|---|---|
| Produk | **Papan** — forecast saham pribadi |
| Repo / folder | `papan-stock-forecast` |
| npm `package.json` name | `papan-saham-forecast` |
| Proyek Vercel | `papan-stock-forecast` |
| Production URL | https://papan-stock-forecast.vercel.app/ |
| Deploy branches | `main` → production; `dev` → preview |
| Stack | Next.js 14 (App Router), React 18, Tailwind CSS |
| UI | Tema papan bursa (navy/gold) — glass panel, atmosfer grid, sinyal HUD |
| Env wajib (deploy) | tidak ada |
| Env opsional (lokal) | `LOCAL_FORECAST_URL` — URL servis XGBoost (default `http://localhost:8000`) |
| Di-ignore git | `node_modules`, `.next`, `.vercel`, `.env*`, `.env*.local` |

## Cara kerja forecast

- **Data**: diambil langsung dari endpoint publik Yahoo Finance
  (`query1/query2.finance.yahoo.com`) lewat API route Next.js, jadi tidak
  kena masalah CORS dan tidak perlu API key. Saham IDX otomatis dikasih
  suffix `.JK` (mis. `BBCA` → `BBCA.JK`); crypto otomatis `*-USD`
  (mis. `BTC` → `BTC-USD`).
- **Tren**: proyeksi 10 hari ke depan pakai *Holt's linear trend method*
  (double exponential smoothing) — metode klasik yang cocok untuk deret
  waktu harga saham tanpa perlu training model berat.
- **Sinyal beli/jual (selektif)**: skor rezim-aware dari SMA20/SMA50,
  RSI(14), MACD (konfirmasi multi-bar), Bollinger (%B), proyeksi Holt,
  relative strength vs indeks (`^JKSE` / `SPY`), plus filter volume & ATR.
  Ambang BUY/SELL lebih ketat (±2.5, atau ±3.2 saat volatilitas tinggi)
  supaya lebih sering HOLD daripada sinyal palsu.
- **Keyakinan & hit-rate**: panel sinyal menampilkan confidence (kesepakatan
  indikator) dan walk-forward hit-rate historis BUY/SELL ~10 hari pada
  ticker yang sama (dihitung di server, ikut ter-deploy).

Semua logic ada di `lib/forecast.js` (indikator + skor + backtest) dan
`lib/yahoo.js` (pengambilan data) — silakan diutak-atik bobot/ambang di
`WEIGHTS` / `ACTION_THRESHOLD`.

## Watchlist

Simpan beberapa ticker lewat tombol "+ watchlist" di halaman hasil forecast.
Watchlist disimpan di `localStorage` browser (personal, per-device, tidak
perlu backend), dan nampilin ringkasan sinyal BUY/SELL/HOLD tiap saham yang
disimpan sekaligus. Klik salah satu card buat lihat detail forecast-nya.
Tombol **Ekspor CSV** mengunduh snapshot harga + sinyal + status syariah
yang sedang tampil.

## Crypto

Pilih bursa **CRYPTO** (contoh ticker `BTC`, `ETH` → Yahoo `BTC-USD` /
`ETH-USD`). Reuse chart + sinyal teknikal + watchlist + jurnal posisi
(currency native USD). Toggle **Tampil USD | Rupiah** mengonversi harga via
kurs Yahoo `USD/IDR` (bukan pair BIDR Binance). Jurnal posisi tetap disimpan
dalam USD. **Tanpa** valuasi fundamental. Syariah = N/A dengan catatan khusus.
Jadwal “cek lagi” memakai **hari kalender** (pasar 24/7), bukan libur bursa.
Relative strength vs `BTC-USD` (atau `ETH-USD` jika asetnya sendiri Bitcoin).
Volatilitas crypto tinggi — perlakukan sinyal sebagai filter, bukan kepastian.

## Jurnal posisi

Catat beli dari hasil forecast (harga, lot, target jual, tanggal cek).
Default tanggal cek = +10 **hari bursa** untuk IDX/US (weekend + libur
dilewati), atau +10 **hari kalender** untuk CRYPTO. Target jual & tanggal
cek bisa di-override. Tombol **Ekspor CSV** untuk backup jurnal.

## Syariah Screener

Badge status syariah muncul di samping nama saham (hasil forecast) dan di
tiap card watchlist. Karena OJK cuma menerbitkan Daftar Efek Syariah (DES)
2x setahun sebagai dokumen (bukan API), app ini pakai referensi lokal di
`data/syariah-list.json` yang kamu update manual — bukan scraping live.
Referensi saat ini mengikuti review JII / DES Periode I 2026
(`KEP-21/D.04/2026`, efektif 2 Juni – 30 November 2026): 30 konstituen JII
di `confirmed_syariah`, plus ticker yang keluar di `confirmed_removed`.
Ticker yang belum ada di file itu ditandai "belum terverifikasi", bukan
ditebak. Cara update ada di `meta.how_to_update` dalam file itu sendiri.
Kriteria ini cuma berlaku untuk saham IDX; US & CRYPTO ditandai "N/A".

## Valuasi Fundamental

Panel tambahan di bawah sinyal teknikal (saham IDX/US saja), isinya CAGR
pertumbuhan laba/revenue historis, CAGR harga, dividend yield, proyeksi
harga 5 tahun, dan Margin of Safety (Graham-style) — dihitung dari
`lib/fundamentalValuation.js` pakai data EPS/P/E dari Yahoo Finance.
Untuk CRYPTO panel ini menampilkan catatan bahwa fundamental tidak
berlaku.

## Forecast lanjutan (opsional, lokal saja)

Ada tambahan model XGBoost yang lebih canggih di folder `local-forecast/`
(Python/FastAPI) — jalan di laptop kamu sendiri, bukan di-deploy ke Vercel.
Kalau lagi jalan (`uvicorn` di `localhost:8000`), app Next.js otomatis
nampilin panel tambahan "XGBoost (local)" di bawah sinyal utama, lengkap
dengan hasil backtest vs baseline SMA. Kalau service-nya nggak nyala,
app tetap jalan normal pakai Holt's + indikator teknikal seperti biasa —
lihat `local-forecast/README.md` buat cara jalaninnya.

## Jalanin lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## Deploy ke Vercel

Proyek Vercel: `papan-stock-forecast` (sudah terhubung ke GitHub
`pratamadli/papan-stock-forecast`). Production branch = **`main`**.

| Branch | Hasil deploy | URL |
|---|---|---|
| `main` | **Production** | https://papan-stock-forecast.vercel.app/ |
| `dev` (dan branch lain) | **Preview** | URL unik per commit (lihat tab Deployments di Vercel) |

Alur kerja yang disarankan:
1. Kerjakan & push ke `dev` → dapat preview otomatis.
2. Merge / push ke `main` → production di https://papan-stock-forecast.vercel.app/

Tidak ada environment variable wajib (Yahoo Finance publik, tanpa key).
Jangan set `LOCAL_FORECAST_URL` di production; XGBoost lokal-only.
Folder `.vercel` hasil `vercel link` sudah di-gitignore.

Ubah production branch (kalau perlu): Vercel → Project Settings →
Environments → Production → Branch Tracking → `main`.
Lihat juga [dokumentasi production branch Vercel](https://vercel.com/docs/git#production-branch).

## Version Update Log

### 1.0.0

Rilis dasar Papan — forecast saham pribadi untuk **IDX** dan **US**:

- Data historis Yahoo Finance (tanpa API key) lewat API route Next.js
- Proyeksi ~10 hari (Holt’s linear trend) + sinyal BUY/SELL/HOLD dari
  indikator teknikal (SMA, RSI, MACD)
- Watchlist & jurnal posisi di `localStorage` (per-browser)
- Badge screener syariah (referensi lokal DES / JII untuk IDX)
- Panel valuasi fundamental (IDX/US)
- Forecast lanjutan XGBoost opsional (servis Python lokal, tidak di-deploy)
- Deploy Vercel: `main` → production, branch lain → preview
- UI tema papan bursa (navy/gold)

### 1.1.0 *(latest)*

Pembaruan di atas 1.0.0:

- Market **CRYPTO** (`BTC` → `BTC-USD`, dll.): chart + sinyal teknikal,
  watchlist, jurnal (USD native); tanpa fundamental; syariah N/A; cek
  pakai hari kalender 24/7
- Toggle tampilan **USD | Rupiah** untuk US & CRYPTO (konversi via kurs
  Yahoo USD/IDR; jurnal tetap USD)
- Sinyal lebih selektif: rezim tren/sideways, Bollinger (%B), filter
  volume & ATR, relative strength, ambang lebih ketat, confidence +
  walk-forward hit-rate di panel sinyal
- Kalender libur bursa (IDX/US) untuk jadwal “cek lagi”
- Override target jual & tanggal cek di jurnal posisi
- Ekspor CSV watchlist dan posisi
- Update referensi syariah JII / DES Periode I 2026
- UI refresh (glass panel, atmosfer, polish autocomplete dropdown)
- Footer versi app (`Papan v…` dari `package.json`)

## Catatan

- Endpoint Yahoo Finance ini tidak resmi didokumentasikan publik, tapi
  dipakai luas (termasuk oleh library `yfinance` di Python) dan stabil
  untuk pemakaian personal/non-komersial dengan volume rendah. Kalau
  suatu saat mereka mulai membatasi, tinggal ganti isi `lib/yahoo.js` ke
  sumber data lain (mis. Stooq, atau IDX resmi untuk saham Indonesia).
- Ini bukan nasihat keuangan — forecast murni statistik dari data historis.
