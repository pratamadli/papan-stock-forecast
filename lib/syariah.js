// Sharia (syariah) status checker.
//
// IMPORTANT: there is no free, live, official API for Indonesia's Daftar
// Efek Syariah (DES) — OJK publishes it as a document twice a year (May
// & November), and IDX publishes JII/JII70/ISSI constituents on its own
// site. Scraping either live is fragile and against IDX's terms of use
// for commercial/redistribution purposes (fine as a one-off manual
// check, not as something this app does automatically on every request).
//
// So this works off data/syariah-list.json, a small manually-maintained
// file you update yourself whenever OJK/IDX publish a new list — see
// that file's `meta.how_to_update` for instructions. Anything not in
// the file returns "unknown", never a guessed "non-syariah".

import syariahData from "../data/syariah-list.json";

export function checkSyariahStatus(rawSymbol, market) {
  if (market !== "IDX") {
    return {
      symbol: rawSymbol,
      status: "not-applicable",
      note:
        "Kriteria DES/OJK cuma berlaku untuk saham IDX. Saham US punya standar syariah sendiri (mis. AAOIFI atau Dow Jones Islamic Market Index) yang belum dicek di sini.",
    };
  }

  const symbol = rawSymbol.replace(".JK", "").trim().toUpperCase();

  const isConfirmedSyariah = syariahData.confirmed_syariah.includes(symbol);
  const isConfirmedRemoved = syariahData.confirmed_removed.includes(symbol);

  let status = "unknown";
  if (isConfirmedSyariah) status = "syariah";
  else if (isConfirmedRemoved) status = "non-syariah";

  return {
    symbol,
    status, // "syariah" | "non-syariah" | "unknown"
    asOf: syariahData.meta.as_of,
    effectivePeriod: syariahData.meta.effective_period,
    note:
      status === "unknown"
        ? "Belum ada di data referensi lokal — cek manual ke DES OJK atau daftar konstituen IDX Syariah sebelum dianggap syariah/non-syariah."
        : null,
  };
}
