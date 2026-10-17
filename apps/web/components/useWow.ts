"use client";
// Wow preferences: one encrypted vault record per dataset (demo vs mine), loaded once, saved on every change.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadRecord, saveRecord } from "@/lib/vault";
import { applyFeeAdd, applyFeeLog, applyFeeRemove, applyFeeReset, demoFeeSeed } from "@/lib/wow/fee-runway";
import { normaliseWow, type WowFee, type WowState } from "@/lib/wow/state";

export interface WowApi {
  ready: boolean;
  state: WowState;
  /** Save the active record (wow.demo or wow.state). Ignored until the vault read has finished. */
  update: (fn: (s: WowState) => WowState) => void;
  resetDemo: () => void;
  /** After "Delete all my data": forget in-memory state (the vault itself is already gone). */
  forgetAll: () => void;
  /** True only on the add that first covers the fee. False when nothing was saved. */
  logFee: (id: string, paise: number) => boolean;
  resetFee: (id: string) => void;
  addFee: (fee: WowFee) => void;
  /** Drops the fee and its set-aside pot. */
  removeFee: (id: string) => void;
}

/** Demo wow preferences: three synthetic yearly fees against the demo clock. */
export function demoWowSeed(now: Date): WowState {
  const seeded = demoFeeSeed(now);
  return normaliseWow({ fees: seeded.fees, setAside: seeded.setAside });
}

export function useWowStore(source: "demo" | "mine", now: Date): WowApi {
  const [loaded, setLoaded] = useState<{ demo: WowState; mine: WowState } | null>(null);
  const at = now.getTime();
  const seed = useMemo(() => demoWowSeed(new Date(at)), [at]);

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

  const logFee = useCallback((id: string, paise: number): boolean => {
    if (!loadedRef.current) return false;
    const { state: s, source: src } = latest.current;
    const outcome = applyFeeLog(s, id, paise);
    if (outcome.state === s) return false;
    const next = normaliseWow(outcome.state);
    latest.current = { ...latest.current, state: next };
    commit(src, next);
    return outcome.fundedNow;
  }, [commit]);

  const resetFee = useCallback((id: string) => {
    update((s) => applyFeeReset(s, id));
  }, [update]);

  const addFee = useCallback((fee: WowFee) => {
    update((s) => applyFeeAdd(s, fee));
  }, [update]);

  const removeFee = useCallback((id: string) => {
    update((s) => applyFeeRemove(s, id));
  }, [update]);

  return { ready: !!loaded, state, update, resetDemo, forgetAll, logFee, resetFee, addFee, removeFee };
}
