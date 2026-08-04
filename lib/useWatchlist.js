"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "papan.watchlist.v1";

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
    // ignore quota/serialization errors — watchlist just won't persist
  }
}

/**
 * Watchlist entries look like { symbol: "BBCA.JK", market: "IDX" }.
 * Persisted to localStorage only — this is a personal single-device app.
 */
export function useWatchlist() {
  const [list, setList] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setList(readStorage());
    setHydrated(true);
  }, []);

  const add = useCallback((symbol, market) => {
    setList((prev) => {
      const normalized = symbol.trim().toUpperCase();
      if (prev.some((e) => e.symbol === normalized && e.market === market)) {
        return prev;
      }
      const next = [...prev, { symbol: normalized, market }];
      writeStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((symbol, market) => {
    setList((prev) => {
      const next = prev.filter((e) => !(e.symbol === symbol && e.market === market));
      writeStorage(next);
      return next;
    });
  }, []);

  const has = useCallback(
    (symbol, market) => {
      const normalized = symbol.trim().toUpperCase();
      return list.some((e) => e.symbol === normalized && e.market === market);
    },
    [list]
  );

  return { list, hydrated, add, remove, has };
}
