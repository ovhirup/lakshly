"use client";
// Weekly review state: one encrypted vault record per dataset (demo vs mine), loaded once, saved on every change.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LakshlyDataset } from "@/lib/schema.gen";
import {
  applyAction, buildInbox, canUndo, isoWeek, localDate, normaliseState, NWV_BY_CATEGORY, type ApplyResult, type Inbox,
  type ReviewAction, type ReviewState, type ReviewTxn, type UndoEntry, type Worth,
} from "@/lib/review";
import { loadRecord, saveRecord } from "@/lib/vault";

export interface ReviewApi {
  ready: boolean;
  state: ReviewState;
  inbox: Inbox;
  /** The review clock: real time for your data; a fixed evening at the end of the demo data for the demo. */
  now: Date;
  dispatch: (a: ReviewAction) => ApplyResult;
  undo: () => string | null;
  undoEntry: UndoEntry | null;
  resetDemo: () => void;
  /** After "Delete all my data": forget in-memory state (the vault itself is already gone). */
  forgetAll: () => void;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Demo clock: 19:00 local on the demo dataset's as-of day. Keeps the demo inbox meaningful forever. */
export function demoNow(ds: LakshlyDataset): Date {
  const asOf = ds.accounts.reduce((m, a) => (a.asOf > m ? a.asOf : m), ds.accounts[0]?.asOf ?? "2026-10-01");
  const [y, m, d] = (isDate(asOf) ? asOf : "2026-10-01").split("-").map(Number);
  return new Date(y, m - 1, d, 19, 0, 0);
}

/**
 * A believable starting point for the synthetic demo: last review ten days before as-of (so about a week is waiting),
 * a 2-week streak, earlier rows already reviewed, and five Worth-it ratings on demo merchants.
 * Built from the synthetic dataset at runtime; contains no real data.
 */
export function demoSeed(ds: LakshlyDataset): ReviewState {
  const now = demoNow(ds);
  const reviewed = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 21, 0, 0);
  const reviewedDay = localDate(reviewed);
  const week = isoWeek(reviewedDay);
  const back = (d: number) => isoWeek(localDate(new Date(reviewed.getFullYear(), reviewed.getMonth(), reviewed.getDate() - d)));
  const s = normaliseState({ clearedWeeks: [back(21), back(7), week], lastReviewedAt: reviewed.toISOString(), lastClearedWeek: week, streak: 2, bestStreak: 4, freezesLeft: 1, clearsTowardFreeze: 2, xp: 86, weekXP: { [week]: 22 } });
  const txns = ds.transactions as ReviewTxn[];
  for (const t of txns) {
    if (t.date > reviewedDay || t.amount >= 0 || t.category === "transfers" || t.category === "income") continue;
    s.decisions[t.id] = { category: t.category, nwv: NWV_BY_CATEGORY[t.category], action: "confirm", at: reviewed.toISOString() };
  }
  const month = reviewedDay.slice(0, 7);
  const wants = txns.filter((t) => t.date.startsWith(month) && t.date <= reviewedDay && t.amount < 0 && NWV_BY_CATEGORY[t.category] === "want").reverse();
  const byMerchant = new Map<string, ReviewTxn[]>();
  for (const t of wants) byMerchant.set(t.merchant ?? t.description, [...(byMerchant.get(t.merchant ?? t.description) ?? []), t]);
  const [regret] = [...byMerchant.entries()].sort((a, b) => b[1].length - a[1].length);
  const rate = (t: ReviewTxn, w: Worth) => { s.worth[t.id] = w; s.decisions[t.id] = { ...s.decisions[t.id], worth: w }; };
  if (regret && regret[1].length >= 3) {
    regret[1].slice(0, 3).forEach((t) => rate(t, "no"));
    [...byMerchant.entries()].filter(([m]) => m !== regret[0]).slice(0, 2).forEach(([, ts]) => rate(ts[0], "yes"));
  }
  return s;
}

export function useReviewStore(source: "demo" | "mine", raw: readonly ReviewTxn[], demo: LakshlyDataset, importedAt: Record<string, string> | undefined): ReviewApi {
  const [loaded, setLoaded] = useState<{ demo: ReviewState; mine: ReviewState } | null>(null);
  const [realNow, setRealNow] = useState<Date>(() => new Date());
  const [undoEntry, setUndo] = useState<UndoEntry | null>(null);
  const seed = useMemo(() => demoSeed(demo), [demo]);

  useEffect(() => {
    let alive = true;
    Promise.all([loadRecord<unknown>("review.demo").catch(() => null), loadRecord<unknown>("review.state").catch(() => null)])
      .then(([d, m]) => { if (alive) setLoaded({ demo: d ? normaliseState(d) : seed, mine: normaliseState(m) }); });
    const t = window.setInterval(() => setRealNow(new Date()), 60_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [seed]);

  const state = loaded ? loaded[source] : source === "demo" ? seed : normaliseState(null);
  const now = useMemo(() => (source === "demo" ? demoNow(demo) : realNow), [source, demo, realNow]);
  const opts = useMemo(() => ({ importedAt: source === "mine" ? importedAt : undefined }), [source, importedAt]);
  const inbox = useMemo(() => buildInbox(raw, state, now, opts), [raw, state, now, opts]);

  const latest = useRef({ state, raw, now, opts, source });
  useEffect(() => { latest.current = { state, raw, now, opts, source }; });

  const commit = useCallback((which: "demo" | "mine", next: ReviewState) => {
    setLoaded((l) => ({ ...(l ?? { demo: seed, mine: normaliseState(null) }), [which]: next }));
    void saveRecord(which === "demo" ? "review.demo" : "review.state", next).catch(() => undefined);
  }, [seed]);

  const dispatch = useCallback((a: ReviewAction) => {
    const { state: s, raw: txns, now: n, opts: o, source: src } = latest.current;
    const r = applyAction(s, a, { txns, now: n, opts: o });
    latest.current = { ...latest.current, state: r.state };
    commit(src, r.state);
    if (a.type !== "skip") setUndo({ prev: s, at: Date.now(), message: r.message });
    return r;
  }, [commit]);

  const undo = useCallback(() => {
    if (!canUndo(undoEntry, Date.now())) { setUndo(null); return null; }
    latest.current = { ...latest.current, state: undoEntry.prev };
    commit(latest.current.source, undoEntry.prev);
    setUndo(null);
    return "Undone.";
  }, [undoEntry, commit]);

  const resetDemo = useCallback(() => { latest.current = { ...latest.current, state: seed }; commit("demo", seed); setUndo(null); }, [commit, seed]);

  const forgetAll = useCallback(() => { setLoaded({ demo: seed, mine: normaliseState(null) }); setUndo(null); }, [seed]);

  return { ready: !!loaded, state, inbox, now, dispatch, undo, undoEntry, resetDemo, forgetAll };
}
