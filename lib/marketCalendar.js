// Trading-day helpers for IDX (BEI) and US (NYSE-style) calendars.
// Weekends are always non-trading. Holidays are a curated subset for
// 2025–2027 — update when BEI / NYSE publish the next year's list.
// Format: YYYY-MM-DD (local calendar date, not UTC).

const IDX_HOLIDAYS = new Set([
  // 2025
  "2025-01-01",
  "2025-01-27", // Isra Miraj (observed around late Jan)
  "2025-01-28", // Chinese New Year
  "2025-01-29",
  "2025-03-28", // Nyepi
  "2025-03-31", // Idul Fitri eve / joint leave cluster
  "2025-04-01",
  "2025-04-02",
  "2025-04-03",
  "2025-04-04",
  "2025-04-07", // cuti bersama Idul Fitri
  "2025-04-18", // Good Friday
  "2025-05-01", // Labor Day
  "2025-05-12", // Waisak
  "2025-05-29", // Ascension of Jesus
  "2025-06-06", // Idul Adha
  "2025-06-09", // cuti bersama Idul Adha
  "2025-06-27", // Islamic New Year
  "2025-08-17", // Independence Day
  "2025-09-05", // Maulid Nabi
  "2025-12-25", // Christmas
  "2025-12-26", // cuti bersama Natal
  // 2026
  "2026-01-01",
  "2026-01-16", // Isra Miraj (approx.)
  "2026-02-17", // Chinese New Year
  "2026-03-19", // Nyepi
  "2026-03-20",
  "2026-03-21", // Idul Fitri cluster (approx.)
  "2026-03-22",
  "2026-03-23",
  "2026-03-24",
  "2026-04-03", // Good Friday
  "2026-05-01",
  "2026-05-14", // Ascension (approx.)
  "2026-05-27", // Waisak (approx.)
  "2026-05-28", // Idul Adha (approx. late May 2026)
  "2026-06-16", // Islamic New Year (approx.)
  "2026-08-17",
  "2026-08-25", // Maulid Nabi (approx.)
  "2026-12-25",
  // 2027 (partial — extend when BEI publishes)
  "2027-01-01",
  "2027-02-06", // Chinese New Year (approx.)
  "2027-08-17",
  "2027-12-25",
]);

const US_HOLIDAYS = new Set([
  // 2025 NYSE
  "2025-01-01",
  "2025-01-20", // MLK
  "2025-02-17", // Presidents'
  "2025-04-18", // Good Friday
  "2025-05-26", // Memorial Day
  "2025-06-19", // Juneteenth
  "2025-07-04", // Independence Day
  "2025-09-01", // Labor Day
  "2025-11-27", // Thanksgiving
  "2025-12-25", // Christmas
  // 2026 NYSE
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03", // Independence Day observed (Fri)
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  // 2027 NYSE (partial)
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-05-31",
  "2027-06-18", // Juneteenth observed
  "2027-07-05", // Independence Day observed
  "2027-09-06",
  "2027-11-25",
  "2027-12-24", // Christmas observed
]);

function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function holidaySet(market) {
  return market === "US" ? US_HOLIDAYS : IDX_HOLIDAYS;
}

/** True if the local calendar date is a trading session for that market. */
export function isTradingDay(date, market = "IDX") {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  // Crypto trades 24/7 — every calendar day counts.
  if (market === "CRYPTO") return true;
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !holidaySet(market).has(toDateKey(d));
}

/**
 * Advance `start` by N sessions.
 * IDX/US: skips weekends + holidays. CRYPTO: plain calendar days (24/7).
 */
export function addTradingDays(start, tradingDays, market = "IDX") {
  const d = new Date(start);
  if (Number.isNaN(d.getTime()) || tradingDays <= 0) return d;

  if (market === "CRYPTO") {
    d.setDate(d.getDate() + tradingDays);
    return d;
  }

  let remaining = tradingDays;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (isTradingDay(d, market)) remaining -= 1;
  }
  return d;
}

export function formatDateKey(date) {
  return toDateKey(date);
}
