# Papan — Forecast Saham Pribadi

App web sederhana untuk forecast harga saham (IDX & US) pakai data historis
dari Yahoo Finance (gratis, tanpa API key), lalu kasih sinyal BUY/SELL/HOLD.

## Cara kerja forecast

- **Data**: diambil langsung dari endpoint publik Yahoo Finance
  (`query1/query2.finance.yahoo.com`) lewat API route Next.js, jadi tidak
  kena masalah CORS dan tidak perlu API key. Saham IDX otomatis dikasih
  suffix `.JK` (mis. `BBCA` → `BBCA.JK`).
- **Tren**: proyeksi 10 hari ke depan pakai *Holt's linear trend method*
  (double exponential smoothing) — metode klasik yang cocok untuk deret
  waktu harga saham tanpa perlu training model berat.
- **Sinyal beli/jual**: gabungan dari crossover SMA20/SMA50, RSI(14),
  histogram MACD, dan arah proyeksi tren, masing-masing dikasih skor lalu
  dijumlah jadi rekomendasi BUY / SELL / HOLD beserta alasannya.

Semua logic ada di `lib/forecast.js` (indikator + skor) dan `lib/yahoo.js`
(pengambilan data) — silakan diutak-atik kalau mau ganti bobot atau nambah
indikator lain.

## Watchlist

Simpan beberapa ticker lewat tombol "+ watchlist" di halaman hasil forecast.
Watchlist disimpan di `localStorage` browser (personal, per-device, tidak
perlu backend), dan nampilin ringkasan sinyal BUY/SELL/HOLD tiap saham yang
disimpan sekaligus. Klik salah satu card buat lihat detail forecast-nya.

## Syariah Screener

Badge status syariah muncul di samping nama saham (hasil forecast) dan di
tiap card watchlist. Karena OJK cuma menerbitkan Daftar Efek Syariah (DES)
2x setahun sebagai dokumen (bukan API), app ini pakai referensi lokal di
`data/syariah-list.json` yang kamu update manual — bukan scraping live.
Ticker yang belum ada di file itu ditandai "belum terverifikasi", bukan
ditebak. Cara update ada di `meta.how_to_update` dalam file itu sendiri.
Kriteria ini cuma berlaku untuk saham IDX; saham US ditandai "N/A" karena
standar syariahnya beda (AAOIFI/Dow Jones Islamic Market).

## Valuasi Fundamental

Panel tambahan di bawah sinyal teknikal, isinya CAGR pertumbuhan laba/
revenue historis, CAGR harga, dividend yield, proyeksi harga 5 tahun, dan
Margin of Safety (Graham-style) — dihitung dari `lib/fundamentalValuation.js`
pakai data EPS/P/E dari Yahoo Finance. Ini pelengkap sinyal teknikal yang
sudah ada, biar keputusan beli/jual mempertimbangkan bisnisnya juga, bukan
cuma pola harga. Detail formulanya ada di komentar file tsb — semua
konsep terbuka (CAGR, Margin of Safety ala Graham), bukan formula
proprietary siapapun.

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

1. Push folder ini ke repo GitHub kamu.
2. Buka https://vercel.com/new, import repo tsb.
3. Vercel otomatis detect Next.js — tidak ada environment variable yang
   wajib diisi (Yahoo Finance endpoint publik, tanpa key).
4. Deploy.

## Catatan

- Endpoint Yahoo Finance ini tidak resmi didokumentasikan publik, tapi
  dipakai luas (termasuk oleh library `yfinance` di Python) dan stabil
  untuk pemakaian personal/non-komersial dengan volume rendah. Kalau
  suatu saat mereka mulai membatasi, tinggal ganti isi `lib/yahoo.js` ke
  sumber data lain (mis. Stooq, atau IDX resmi untuk saham Indonesia).
- Ini bukan nasihat keuangan — forecast murni statistik dari data historis.
