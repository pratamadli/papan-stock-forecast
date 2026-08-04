"use client";

import { useEffect, useState, useCallback } from "react";
import { computeCheckAt } from "./positionAdvice";

const STORAGE_KEY = "papan.positions.v1";

function readStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStorage(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota/serialization errors — positions just won't persist
  }
}

function makeId() {
  return `pos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseOptionalPrice(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Personal buy→check→sell journal.
 * Entries look like:
 * {
 *   id, symbol, market, buyAt, buyPrice, lots,
 *   checkAt, checkAtManual, targetPrice, targetManual,
 *   status: "open"|"closed", sellAt?, sellPrice?
 * }
 */
export function usePositions() {
  const [list, setList] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setList(readStorage());
    setHydrated(true);
  }, []);

  const add = useCallback(
    ({
      symbol,
      market,
      buyAt,
      buyPrice,
      lots = 1,
      targetPrice = null,
      checkAt = null,
      targetManual = false,
      checkAtManual = false,
    }) => {
      const normalized = symbol.trim().toUpperCase();
      const price = Number(buyPrice);
      const lotCount = Number(lots) > 0 ? Number(lots) : 1;
      if (!normalized || !buyAt || !Number.isFinite(price) || price <= 0) {
        return null;
      }

      const currency = market === "IDX" ? "IDR" : "USD"; // US + CRYPTO → USD
      const manualCheck = Boolean(checkAtManual && checkAt);
      const resolvedCheckAt = manualCheck
        ? new Date(checkAt)
        : computeCheckAt(buyAt, undefined, market);

      if (Number.isNaN(resolvedCheckAt.getTime())) return null;

      const parsedTarget = parseOptionalPrice(targetPrice);

      const entry = {
        id: makeId(),
        symbol: normalized,
        market,
        currency,
        buyAt: new Date(buyAt).toISOString(),
        buyPrice: price,
        lots: lotCount,
        checkAt: resolvedCheckAt.toISOString(),
        checkAtManual: manualCheck,
        targetPrice: parsedTarget,
        targetManual: Boolean(targetManual && parsedTarget != null),
        status: "open",
        sellAt: null,
        sellPrice: null,
        createdAt: new Date().toISOString(),
      };

      setList((prev) => {
        const next = [entry, ...prev];
        writeStorage(next);
        return next;
      });
      return entry;
    },
    []
  );

  const update = useCallback((id, patch) => {
    if (!id || !patch) return;

    setList((prev) => {
      const next = prev.map((p) => {
        if (p.id !== id || p.status !== "open") return p;

        const updated = { ...p };

        if ("targetPrice" in patch) {
          const parsed = parseOptionalPrice(patch.targetPrice);
          updated.targetPrice = parsed;
          updated.targetManual = parsed != null;
        }

        if ("checkAt" in patch && patch.checkAt) {
          const d = new Date(patch.checkAt);
          if (!Number.isNaN(d.getTime())) {
            updated.checkAt = d.toISOString();
            updated.checkAtManual = true;
          }
        }

        if (patch.resetCheckAt) {
          updated.checkAt = computeCheckAt(p.buyAt, undefined, p.market).toISOString();
          updated.checkAtManual = false;
        }

        if (patch.resetTarget) {
          updated.targetPrice =
            patch.defaultTarget != null
              ? parseOptionalPrice(patch.defaultTarget)
              : updated.targetPrice;
          updated.targetManual = false;
        }

        return updated;
      });
      writeStorage(next);
      return next;
    });
  }, []);

  const close = useCallback((id, { sellAt, sellPrice }) => {
    const price = Number(sellPrice);
    if (!id || !sellAt || !Number.isFinite(price) || price <= 0) return;

    setList((prev) => {
      const next = prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "closed",
              sellAt: new Date(sellAt).toISOString(),
              sellPrice: price,
            }
          : p
      );
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setList((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  const open = list.filter((p) => p.status === "open");
  const closed = list.filter((p) => p.status === "closed");

  return { list, open, closed, hydrated, add, update, close, remove };
}
