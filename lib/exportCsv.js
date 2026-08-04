// Client-side CSV helpers for watchlist & position journal export.

function escapeCell(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCell(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename, csvText) {
  if (typeof window === "undefined") return;
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportWatchlistCsv(rows) {
  const headers = [
    "symbol",
    "market",
    "price",
    "currency",
    "signal",
    "score",
    "syariah",
    "exportedAt",
  ];
  const exportedAt = new Date().toISOString();
  const data = rows.map((r) => ({
    symbol: r.symbol,
    market: r.market,
    price: r.price ?? "",
    currency: r.currency ?? "",
    signal: r.signal ?? "",
    score: r.score ?? "",
    syariah: r.syariah ?? "",
    exportedAt,
  }));
  downloadCsv(`papan-watchlist-${stamp()}.csv`, rowsToCsv(headers, data));
}

export function exportPositionsCsv(rows) {
  const headers = [
    "symbol",
    "market",
    "status",
    "buyAt",
    "buyPrice",
    "lots",
    "checkAt",
    "checkAtManual",
    "targetPrice",
    "targetManual",
    "currentPrice",
    "signal",
    "pnlPct",
    "pnlNominal",
    "sellAt",
    "sellPrice",
    "currency",
    "exportedAt",
  ];
  const exportedAt = new Date().toISOString();
  const data = rows.map((r) => ({
    symbol: r.symbol,
    market: r.market,
    status: r.status,
    buyAt: r.buyAt ?? "",
    buyPrice: r.buyPrice ?? "",
    lots: r.lots ?? "",
    checkAt: r.checkAt ?? "",
    checkAtManual: r.checkAtManual ? "yes" : "no",
    targetPrice: r.targetPrice ?? "",
    targetManual: r.targetManual ? "yes" : "no",
    currentPrice: r.currentPrice ?? "",
    signal: r.signal ?? "",
    pnlPct: r.pnlPct != null ? (r.pnlPct * 100).toFixed(2) : "",
    pnlNominal: r.pnlNominal ?? "",
    sellAt: r.sellAt ?? "",
    sellPrice: r.sellPrice ?? "",
    currency: r.currency ?? "",
    exportedAt,
  }));
  downloadCsv(`papan-positions-${stamp()}.csv`, rowsToCsv(headers, data));
}
