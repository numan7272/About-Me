"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persistent "secrets discovered" tracker.
 *
 * Stores the set of discovered Easter-egg ids in localStorage so a return
 * visit remembers what the player has already found. The four expected
 * ids are kept here so consumers don't have to import them — keeps this
 * module standalone and easy to retrofit if the egg set changes.
 *
 * Usage:
 *   const { isDiscovered, markDiscovered, count, total, justUnlocked } = useDiscoveries();
 */

const STORAGE_KEY    = "numan-roadmap.discoveries.v1";
const ALL_EGG_IDS    = ["raspberrypi", "router", "container", "weight"];
export const TOTAL_DISCOVERIES = ALL_EGG_IDS.length;

function readStore() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => ALL_EGG_IDS.includes(id)) : []);
  } catch {
    return new Set();
  }
}

function writeStore(set) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Quota exceeded / disabled storage — nothing useful to do.
  }
}

export default function useDiscoveries() {
  // Start from an empty set on the server / first render to avoid SSR
  // hydration mismatch, then hydrate from localStorage on mount.
  const [found, setFound]               = useState(() => new Set());
  const [hydrated, setHydrated]         = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(null);

  useEffect(() => {
    setFound(readStore());
    setHydrated(true);
  }, []);

  const isDiscovered = useCallback(
    (id) => found.has(id),
    [found],
  );

  const markDiscovered = useCallback((id) => {
    if (!ALL_EGG_IDS.includes(id)) return;
    setFound((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeStore(next);
      // Surface this id to consumers so they can show a one-shot toast.
      // Cleared after the consumer reads it (see clearJustUnlocked below).
      setJustUnlocked(id);
      return next;
    });
  }, []);

  const clearJustUnlocked = useCallback(() => setJustUnlocked(null), []);

  return {
    isDiscovered,
    markDiscovered,
    count: found.size,
    total: TOTAL_DISCOVERIES,
    allFound: hydrated && found.size === TOTAL_DISCOVERIES,
    justUnlocked,
    clearJustUnlocked,
    hydrated,
  };
}
