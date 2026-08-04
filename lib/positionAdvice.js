// Pure helpers for the personal buy→check→sell journal.
// Horizon matches the main Holt's forecast window (10 trading days).

import { addTradingDays } from "./marketCalendar";

export const CHECK_HORIZON_DAYS = 10;

/**
 * Buy datetime + N trading days (skips weekends + curated exchange holidays).
 * @param {string|Date} buyAt
 * @param {number} [days]
 * @param {"IDX"|"US"|"CRYPTO"} [market]
 */
export function computeCheckAt(buyAt, days = CHECK_HORIZON_DAYS, market = "IDX") {
  return addTradingDays(buyAt, days, market);
}

/**
 * @param {object} opts
 * @param {object} opts.position
 * @param {object|null} opts.signal  from buildSignal /api/stock
 * @param {number|null} opts.currentPrice
 */
export function buildAdvice({ position, signal = null, currentPrice = null }) {
  const buyPrice = position.buyPrice;
  const lots = position.lots > 0 ? position.lots : 1;
  const checkAt = new Date(
    position.checkAt || computeCheckAt(position.buyAt, CHECK_HORIZON_DAYS, position.market)
  );
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfCheck = new Date(checkAt);
  startOfCheck.setHours(0, 0, 0, 0);

  let checkStatus = "upcoming"; // upcoming | due | overdue
  if (startOfCheck.getTime() === startOfToday.getTime()) checkStatus = "due";
  else if (startOfCheck < startOfToday) checkStatus = "overdue";

  const priceForPnl =
    position.status === "closed" && position.sellPrice != null
      ? position.sellPrice
      : currentPrice;

  let pnlPct = null;
  let pnlNominal = null;
  if (priceForPnl != null && buyPrice > 0) {
    pnlPct = (priceForPnl - buyPrice) / buyPrice;
    pnlNominal = (priceForPnl - buyPrice) * lots;
  }

  const targetPrice = position.targetPrice;
  const targetHit =
    currentPrice != null && targetPrice != null && currentPrice >= targetPrice;

  const action = signal?.action || null;
  let sellAdvice = "tahan";
  let sellReason = `Tahan dulu; cek lagi pada ${formatDateTime(checkAt)}.`;

  if (position.status === "closed") {
    sellAdvice = "sudah_dijual";
    sellReason = `Posisi sudah ditutup pada ${formatDateTime(position.sellAt)}.`;
  } else if (action === "SELL") {
    sellAdvice = "jual";
    sellReason = "Sinyal live SELL — pertimbangkan jual sekarang.";
  } else if (targetHit) {
    sellAdvice = "jual";
    sellReason = "Harga sudah mencapai / melewati target jual.";
  } else if (checkStatus === "due" || checkStatus === "overdue") {
    if (action === "BUY") {
      sellAdvice = "tahan";
      sellReason =
        checkStatus === "overdue"
          ? "Sudah lewat jadwal cek; sinyal masih BUY — boleh tahan, pantau ulang."
          : "Hari ini jadwal cek; sinyal masih BUY — boleh tahan.";
    } else if (action === "HOLD") {
      sellAdvice = "cek";
      sellReason =
        checkStatus === "overdue"
          ? "Sudah lewat jadwal cek; sinyal HOLD — review posisi hari ini."
          : "Hari ini jadwal cek; sinyal HOLD — review apakah tetap tahan.";
    } else {
      sellAdvice = "cek";
      sellReason =
        checkStatus === "overdue"
          ? "Sudah lewat jadwal cek — buka forecast dan review posisi."
          : "Hari ini jadwal cek ulang posisi.";
    }
  } else if (action === "BUY") {
    sellAdvice = "tahan";
    sellReason = `Sinyal masih BUY; cek lagi pada ${formatDateTime(checkAt)}.`;
  }

  return {
    checkAt: checkAt.toISOString(),
    checkStatus,
    checkLabel: checkStatusLabel(checkStatus, checkAt, position.checkAtManual),
    targetPrice,
    targetHit,
    sellAdvice, // tahan | cek | jual | sudah_dijual
    sellReason,
    pnlPct,
    pnlNominal,
    currentPrice: priceForPnl,
  };
}

function checkStatusLabel(status, checkAt, manual) {
  const when = formatDateTime(checkAt);
  const tag = manual ? " · manual" : "";
  if (status === "due") return `Cek lagi: hari ini (${when})${tag}`;
  if (status === "overdue") return `Cek lagi: sudah lewat (${when})${tag}`;
  return `Cek lagi: ${when}${tag}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format for <input type="datetime-local"> in local timezone. */
export function toDatetimeLocalValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format for <input type="date"> in local timezone. */
export function toDateInputValue(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
