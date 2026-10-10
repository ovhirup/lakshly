"use client";
// Badges + nudges state: append-only ledger and nudge log in the encrypted vault (separate demo record), coach prefs in localStorage.
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useData } from "./DataState";
import { useTier } from "./useTier";
import { usePrivacy } from "./Privacy";
import { formatINR } from "@/lib/format";
import { effectiveNwv, levelFor, type ReviewTxn } from "@/lib/review";
import {
  applyXp, badgeById, buildFacts, emptyLedger, evaluate, isSingleTier, mergeLedger, nextUp, normaliseLedger, TIER_META,
  type BadgeEval, type Facts, type Ledger, type LedgerEntry, type XpSummary,
} from "@/lib/badges";
import { buildCandidates, historyDays, roastOff } from "@/lib/nudge-facts";
import { DEFAULT_PREFS, decide, logAction, renderNudge, whyText, type CoachPrefs, type Decision, type LogEntry, type NudgeAction } from "@/lib/nudges";
import { loadRecord, saveRecord, VAULT_DELETED_EVENT } from "@/lib/vault";
import { maskPctText, pctMasked } from "@/lib/privacy";
import "./game.css";

interface Store { ledger: Ledger; nudges: LogEntry[] }
const fresh = (): Store => ({ ledger: emptyLedger(), nudges: [] });

const PREFS_KEY = "lk-coach";
const subPrefs = (l: () => void) => { window.addEventListener("storage", l); window.addEventListener(PREFS_KEY, l); return () => { window.removeEventListener("storage", l); window.removeEventListener(PREFS_KEY, l); }; };
export function parsePrefs(raw: string | null): CoachPrefs {
  try {
    const p = JSON.parse(raw ?? "{}");
    return { v: 1, tone: p.tone === "hype" || p.tone === "roast" ? p.tone : "straight", sources: p.sources && typeof p.sources === "object" ? p.sources : {}, ...(typeof p.guardrailOptOutUntil === "string" ? { guardrailOptOutUntil: p.guardrailOptOutUntil } : {}) };
  } catch { return DEFAULT_PREFS; }
}
export function saveCoachPrefs(p: CoachPrefs) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); window.dispatchEvent(new Event(PREFS_KEY)); }

interface GameCtx {
  ready: boolean;
  facts: Facts;
  evals: BadgeEval[];
  ledger: Ledger;
  xp: XpSummary;
  totalXP: number;
  decision: Decision;
  prefs: CoachPrefs;
  log: LogEntry[];
  nudgeAct: (action: NudgeAction) => void;
  markShown: () => void;
  unsnooze: (id: string, subject: string) => void;
  ackBackfill: () => void;
}
const Ctx = createContext<GameCtx | null>(null);
export const useGame = () => { const c = useContext(Ctx); if (!c) throw new Error("useGame outside GameProvider"); return c; };

export function GameProvider({ children }: { children: React.ReactNode }) {
  const d = useData();
  const { can } = useTier();
  const roastAllowed = can("nudges.tone.roast");
  const { review, source } = d;
  const [stores, setStores] = useState<{ demo: Store; mine: Store } | null>(null);
  const [unlocks, setUnlocks] = useState<LedgerEntry[]>([]);
  const prefsRaw = useSyncExternalStore(subPrefs, () => localStorage.getItem(PREFS_KEY), () => null);
  const prefs = useMemo(() => parsePrefs(prefsRaw), [prefsRaw]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadRecord<Store>("game.demo").catch(() => null),
      loadRecord<unknown>("game.ledger").catch(() => null),
      loadRecord<LogEntry[]>("game.nudges").catch(() => null),
    ]).then(([demo, ml, mn]) => {
      if (!alive) return;
      setStores({
        demo: demo ? { ledger: normaliseLedger(demo.ledger), nudges: Array.isArray(demo.nudges) ? demo.nudges : [] } : fresh(),
        mine: { ledger: normaliseLedger(ml), nudges: Array.isArray(mn) ? mn : [] },
      });
    });
    return () => { alive = false; };
  }, []);

  const store = stores ? stores[source] : fresh();
  const facts = useMemo(() => buildFacts({
    transactions: d.transactions as ReviewTxn[], budgets: d.budgets, debts: d.debts, sips: d.sips, accounts: d.accounts,
    clearedWeeks: review.state.clearedWeeks, nwvOf: (t) => effectiveNwv(t, review.state), now: review.now,
  }), [d.transactions, d.budgets, d.debts, d.sips, d.accounts, review.state, review.now]);
  const evals = useMemo(() => evaluate(facts), [facts]);

  const persist = useCallback((which: "demo" | "mine", next: Store) => {
    setStores((s) => ({ ...(s ?? { demo: fresh(), mine: fresh() }), [which]: next }));
    if (which === "demo") void saveRecord("game.demo", next).catch(() => undefined);
    else { void saveRecord("game.ledger", next.ledger).catch(() => undefined); void saveRecord("game.nudges", next.nudges).catch(() => undefined); }
  }, []);

  // Merge new unlocks into the append-only ledger (only once the vault has been read, and only with data present).
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; });
  useEffect(() => {
    if (!stores || !review.ready || (source === "mine" && !d.ready) || !facts.firstDate) return;
    const { ledger, added } = mergeLedger(storeRef.current.ledger, evals, facts.today);
    if (!added.length && storeRef.current.ledger.firstRunAt) return;
    persist(source, { ...storeRef.current, ledger });
    const live = added.filter((a) => !a.backfill);
    if (live.length) setUnlocks((u) => [...u, ...live]);
  }, [evals, stores, review.ready, d.ready, source, facts.firstDate, facts.today, persist]);

  const xp = useMemo(() => applyXp(store.ledger, facts.today), [store.ledger, facts.today]);
  const candidates = useMemo(() => buildCandidates(facts, evals, review.inbox.count, d.rewards), [facts, evals, review.inbox.count, d.rewards]);
  const decision = useMemo(() => decide({ candidates, log: store.nudges, prefs, now: review.now, historyDays: historyDays(facts), premium: roastAllowed, roastOff: roastOff(facts) }),
    [candidates, store.nudges, prefs, review.now, facts, roastAllowed]);

  // Log "shown" once per day, called by the matching NudgeCard only when it is actually on screen.
  const markShown = useCallback(() => {
    const s = decision.shown;
    if (!stores || !s) return;
    const today = facts.today;
    const already = storeRef.current.nudges.some((e) => e.action === "shown" && e.id === s.id && e.subject === s.subject && e.at.slice(0, 10) === today);
    if (already) return;
    persist(source, { ...storeRef.current, nudges: logAction(storeRef.current.nudges, { id: s.id, subject: s.subject, at: `${today}T${review.now.toTimeString().slice(0, 8)}`, action: "shown", polarity: s.def.polarity }) });
  }, [decision.shown, stores, facts.today, persist, source, review.now]);

  // "Delete all my data" removes the vault; drop the in-memory copy too so deleted badges/nudges can't come back.
  useEffect(() => {
    const onDeleted = () => { setStores({ demo: fresh(), mine: fresh() }); setUnlocks([]); };
    window.addEventListener(VAULT_DELETED_EVENT, onDeleted);
    return () => window.removeEventListener(VAULT_DELETED_EVENT, onDeleted);
  }, []);

  const nudgeAct = useCallback((action: NudgeAction) => {
    const s = decision.shown;
    if (!s) return;
    persist(source, { ...storeRef.current, nudges: logAction(storeRef.current.nudges, { id: s.id, subject: s.subject, at: `${facts.today}T${review.now.toTimeString().slice(0, 8)}`, action, polarity: s.def.polarity }) });
  }, [decision.shown, persist, source, facts.today, review.now]);
  const unsnooze = useCallback((id: string, subject: string) => {
    persist(source, { ...storeRef.current, nudges: storeRef.current.nudges.filter((e) => !(e.id === id && e.subject === subject && ["notNow", "snooze7", "snooze30", "off"].includes(e.action))) });
  }, [persist, source]);
  const ackBackfill = useCallback(() => persist(source, { ...storeRef.current, ledger: { ...storeRef.current.ledger, backfillAck: true } }), [persist, source]);

  const value: GameCtx = { ready: !!stores, facts, evals, ledger: store.ledger, xp, totalXP: review.state.xp + xp.total, decision, prefs, log: store.nudges, nudgeAct, markShown, unsnooze, ackBackfill };
  return (
    <Ctx.Provider value={value}>
      {children}
      <UnlockToasts unlocks={unlocks} onDone={() => setUnlocks([])} />
    </Ctx.Provider>
  );
}

function UnlockToasts({ unlocks, onDone }: { unlocks: LedgerEntry[]; onDone: () => void }) {
  useEffect(() => {
    if (!unlocks.length) return;
    const t = window.setTimeout(onDone, 7000);
    return () => window.clearTimeout(t);
  }, [unlocks, onDone]);
  if (!unlocks.length) return null;
  const u = unlocks[unlocks.length - 1];
  const b = badgeById(u.id);
  if (!b) return null;
  const gold = u.tier === "gold";
  return (
    <div className={`toast glass unlock-toast ${gold ? "gold" : ""}`} role="status">
      <div className="unlock-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 5) * 80}ms` }} />)}</div>
      <span className="unlock-emoji" aria-hidden="true">{b.emoji}</span>
      <div><b>New badge: {b.name}{isSingleTier(b) ? "" : ` ${TIER_META[u.tier].medal} ${TIER_META[u.tier].label}`}</b><p className="tiny muted">+{u.xp} XP{unlocks.length > 1 ? ` · and ${unlocks.length - 1} more` : ""}</p></div>
      <Link className="btn ghost" href={`/badges/#${u.id}`} onClick={onDone}>See</Link>
      <button className="icon-btn" aria-label="Dismiss" onClick={onDone}>×</button>
    </div>
  );
}

// ---------------- small UI pieces ----------------
export function NextUpStrip() {
  const { evals } = useGame();
  const items = nextUp(evals);
  if (!items.length) return null;
  return (
    <div className="nextup" aria-label="Next badges">
      <span className="nextup-label">Next up</span>
      {items.map((p) => {
        const b = badgeById(p.id)!;
        return (
          <Link key={`${p.id}${p.tier}${p.entity ?? ""}`} href={`/badges/#${p.id}`} className="nextup-chip">
            <span className="mini-ring" style={{ "--p": `${Math.round(p.pct * 100)}%` } as React.CSSProperties} role="img" aria-label={pctMasked() ? "Progress hidden" : `${Math.round(p.pct * 100)} percent`}><span aria-hidden="true">{b.emoji}</span></span>
            <span><b>{b.name}{isSingleTier(b) ? "" : ` ${TIER_META[p.tier].label.toLowerCase()}`}</b><small>{maskPctText(p.hint)}</small></span>
          </Link>
        );
      })}
    </div>
  );
}

export function BackfillCard() {
  const { ledger, xp, ackBackfill } = useGame();
  const found = Object.values(ledger.entries).filter((e) => e.backfill).length;
  if (!found || ledger.backfillAck) return null;
  return (
    <div className="backfill glass">
      <span aria-hidden="true">🎉</span>
      <div className="grow"><b>We found {found} badge{found === 1 ? "" : "s"} in your history</b><p className="tiny muted">+{xp.historyBonus} XP history bonus{xp.historyEarned > xp.historyBonus ? ` (capped from ${xp.historyEarned})` : ""}. Badges are never taken away.</p></div>
      <Link className="btn primary" href="/badges/">See badges</Link>
      <button className="btn ghost" onClick={ackBackfill}>Got it</button>
    </div>
  );
}

export function LevelLine() {
  const { totalXP } = useGame();
  const l = levelFor(totalXP);
  return <span>Level {l.current.level} {l.current.name} · {totalXP} XP</span>;
}

export function NudgeCard({ screen }: { screen: "overview" | "spend" }) {
  const { decision, nudgeAct, markShown, facts } = useGame();
  const { masked } = usePrivacy();
  const [why, setWhy] = useState(false);
  const [gone, setGone] = useState<string | null>(null);
  const s = decision.shown;
  const visible = !!s && s.def.screen === screen && gone !== `${s.id}:${s.subject}`;
  useEffect(() => { if (visible) markShown(); }, [visible, markShown]);
  if (!s || !visible) return null;
  const money = (p: number) => formatINR(p);
  const text = renderNudge(s.def, s, decision.tone, masked, money);
  const icon = s.def.polarity === "negative" ? "🧭" : s.def.polarity === "positive" ? "🌟" : "💡";
  const act = (a: NudgeAction) => { nudgeAct(a); if (a !== "tapped") setGone(`${s.id}:${s.subject}`); };
  return (
    <div className={`nudge glass ${s.def.polarity}`} role="region" aria-label="Coach">
      <div className="nudge-main">
        <span className="nudge-icon" aria-hidden="true">{icon}</span>
        <p className="nudge-text">{text}</p>
      </div>
      {decision.toneNotice && <p className="tiny muted">{decision.toneNotice}</p>}
      <div className="row-actions">
        <Link className="btn primary" href={s.def.action.href} onClick={() => act("tapped")}>{s.def.action.label}</Link>
        <button className="btn ghost" onClick={() => act("notNow")}>Not now</button>
        <button className="linkish" aria-expanded={why} onClick={() => setWhy(!why)}>Why?</button>
      </div>
      {why && (
        <div className="nudge-why">
          <p><b>Why you&apos;re seeing this:</b> {whyText(s.def, s, money)}</p>
          <p className="tiny muted">Based on your data through {facts.asOf}. At most one nudge a day; nothing leaves this device.</p>
          <div className="row-actions">
            <button className="btn ghost" onClick={() => act("snooze7")}>Snooze 7 days</button>
            <button className="btn ghost" onClick={() => act("snooze30")}>Snooze 30 days</button>
            <button className="btn ghost" onClick={() => act("off")}>Turn off this nudge</button>
          </div>
        </div>
      )}
    </div>
  );
}
