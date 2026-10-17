"use client";
// Wow preferences: one encrypted vault record per dataset (demo vs mine), loaded once, saved on every change.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadRecord, saveRecord } from "@/lib/vault";
import { normaliseWow, type WowState } from "@/lib/wow/state";

export interface WowApi {
  ready: boolean;
  state: WowState;
  /** Save the active record (wow.demo or wow.state). Ignored until the vault read has finished. */
  update: (fn: (s: WowState) => WowState) => void;
  resetDemo: () => void;
  /** After "Delete all my data": forget in-memory state (the vault itself is already gone). */
  forgetAll: () => void;
}

/** Empty wow preferences. Round 1c fills the demo fees. */
export function demoWowSeed(): WowState {
  return normaliseWow(null);
}

export function useWowStore(source: "demo" | "mine"): WowApi {
  const [loaded, setLoaded] = useState<{ demo: WowState; mine: WowState } | null>(null);
  const seed = useMemo(() => demoWowSeed(), []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadRecord<unknown>("wow.demo").catch(() => null), loadRecord<unknown>("wow.state").catch(() => null)])
      .then(([d, m]) => { if (alive) setLoaded((l) => l ?? { demo: d ? normaliseWow(d) : seed, mine: normaliseWow(m) }); });
    return () => { alive = false; };
  }, [seed]);

  const state = loaded ? loaded[source] : source === "demo" ? seed : normaliseWow(null);

  const loadedRef = useRef(false);
  useEffect(() => { loadedRef.current = !!loaded; }, [loaded]);
  const latest = useRef({ state, source });
  useEffect(() => { latest.current = { state, source }; });

  const commit = useCallback((which: "demo" | "mine", next: WowState) => {
    const clean = normaliseWow(next);
    setLoaded((l) => ({ ...(l ?? { demo: seed, mine: normaliseWow(null) }), [which]: clean }));
    void saveRecord(which === "demo" ? "wow.demo" : "wow.state", clean).catch(() => undefined);
  }, [seed]);

  const update = useCallback((fn: (s: WowState) => WowState) => {
    if (!loadedRef.current) return;
    const { state: s, source: src } = latest.current;
    const next = normaliseWow(fn(s));
    latest.current = { ...latest.current, state: next };
    commit(src, next);
  }, [commit]);

  const resetDemo = useCallback(() => {
    latest.current = { ...latest.current, state: seed };
    commit("demo", seed);
  }, [commit, seed]);

  const forgetAll = useCallback(() => { setLoaded({ demo: seed, mine: normaliseWow(null) }); }, [seed]);

  return { ready: !!loaded, state, update, resetDemo, forgetAll };
}
