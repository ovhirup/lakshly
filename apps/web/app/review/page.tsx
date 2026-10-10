"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Glass, PageHeader } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { usePrivacy } from "@/components/Privacy";
import { WorthItCard } from "@/components/ReviewParts";
import { useGame } from "@/components/Game";
import { Icon } from "@/components/Icon";
import { Switch } from "@/components/PrivacySettings";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/selectors";
import {
  CATEGORIES, countLabel, levelFor, NWV_META, RULES, streakText, weekNumber,
  type InboxRow, type Nwv, type ReviewAction, type Worth,
} from "@/lib/review";
import type { Category } from "@/lib/schema.gen";
import "@/components/review.css";

const PREFS_KEY = "lk-review-prefs";
type Prefs = { reminder: boolean; weekday: number; hour: number };
const subscribeWide = (l: () => void) => { const mq = window.matchMedia("(min-width: 900px)"); mq.addEventListener("change", l); return () => mq.removeEventListener("change", l); };
const subscribePrefs = (l: () => void) => { window.addEventListener("storage", l); window.addEventListener("lk-review-prefs", l); return () => { window.removeEventListener("storage", l); window.removeEventListener("lk-review-prefs", l); }; };
const readPrefs = (): Prefs => {
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}"); return { reminder: p.reminder !== false, weekday: 7, hour: 19 }; } catch { return { reminder: true, weekday: 7, hour: 19 }; }
};

function NwvChip({ nwv }: { nwv: Nwv | null }) {
  if (!nwv) return <span className="nwv-chip refund">↩︎ Refund</span>;
  return <span className={`nwv-chip ${nwv}`}><span aria-hidden="true">{NWV_META[nwv].icon}</span> {NWV_META[nwv].label}</span>;
}

function WorthChips({ id, worth, onRate }: { id: string; worth?: Worth; onRate: (id: string, w: Worth | null) => void }) {
  return (
    <span className="worth-chips" role="group" aria-label="Worth it?">
      <button type="button" className={`worth-chip ${worth === "yes" ? "on" : ""}`} aria-pressed={worth === "yes"} aria-label="Worth it" title="Worth it (W)" onClick={(e) => { e.stopPropagation(); onRate(id, worth === "yes" ? null : "yes"); }}>👍</button>
      <button type="button" className={`worth-chip ${worth === "no" ? "on" : ""}`} aria-pressed={worth === "no"} aria-label="Not really" title="Not really (Q)" onClick={(e) => { e.stopPropagation(); onRate(id, worth === "no" ? null : "no"); }}>👎</button>
    </span>
  );
}

function Editor({ row, onSave, onCancel }: { row: InboxRow; onSave: (c: Category, n: Nwv | null, remember: boolean) => void; onCancel: () => void }) {
  const [cat, setCat] = useState<Category>(row.suggestion.category);
  const [nwv, setNwv] = useState<Nwv | null>(row.suggestion.nwv);
  const [remember, setRemember] = useState(false);
  const merchant = row.tx.merchant ?? row.tx.description;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  if (row.refund) return <div className="review-editor"><p className="muted tiny">Refunds can only be confirmed.</p></div>;
  return (
    <div className="review-editor" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } }}>
      <p className="editor-label">Category</p>
      <div className="cat-grid" role="radiogroup" aria-label="Category">
        {CATEGORIES.map((c, i) => (
          <button key={c} ref={c === cat || (i === 0 && !CATEGORIES.includes(cat)) ? first : undefined} type="button" role="radio" aria-checked={cat === c}
            className={`cat-opt ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
            <span className="dot" style={{ background: CATEGORY_COLORS[c] ?? "var(--lk-text-muted)" }} />{titleCase(c)}
          </button>
        ))}
      </div>
      <p className="editor-label">Need, Want or Vice</p>
      <div className="chips" role="radiogroup" aria-label="Need, Want or Vice">
        {(["need", "want", "vice"] as Nwv[]).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={nwv === n} className={`chip ${nwv === n ? "active" : ""}`} onClick={() => setNwv(n)}>{NWV_META[n].icon} {NWV_META[n].label}</button>
        ))}
      </div>
      <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember for {merchant}</label>
      <div className="row-actions">
        <button className="btn primary" type="button" onClick={() => onSave(cat, nwv, remember)}>Save · +{RULES.xp.change} XP</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function useSwipe(onRight: () => void, onLeft: () => void) {
  const start = useRef<{ x: number; y: number; id: number; w: number } | null>(null);
  const [dx, setDx] = useState(0);
  return {
    dx,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button,input,label")) return;
        start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, w: e.currentTarget.offsetWidth };
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const s = start.current;
        if (!s || s.id !== e.pointerId) return;
        const x = e.clientX - s.x;
        if (Math.abs(e.clientY - s.y) > 30 && Math.abs(x) < 20) { start.current = null; setDx(0); return; }
        setDx(x);
      },
      onPointerUp: () => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const threshold = Math.min(80, s.w * 0.35);
        if (dx > threshold) onRight(); else if (dx < -threshold) onLeft();
        setDx(0);
      },
      onPointerCancel: () => { start.current = null; setDx(0); },
    },
  };
}

function Row({ row, selected, editing, worth, onSelect, act, onEdit, onRate, children }: {
  row: InboxRow; selected: boolean; editing: boolean; worth?: Worth; onSelect: () => void; act: (a: ReviewAction) => void; onEdit: () => void;
  onRate: (id: string, w: Worth | null) => void; children?: React.ReactNode;
}) {
  const { masked } = usePrivacy();
  const t = row.tx;
  const merchant = t.merchant ?? t.description;
  const { dx, handlers } = useSwipe(() => act({ type: "confirm", tx: t.id }), onEdit);
  const amount = formatINR(t.amount, { decimals: true, signed: row.refund });
  const label = `${merchant}, ${formatDate(t.date)}, ${titleCase(row.suggestion.category)}${row.suggestion.nwv ? `, ${NWV_META[row.suggestion.nwv].label}` : ", Refund"}, ${masked ? "Amount hidden" : amount}. Suggested.`;
  const ratable = row.suggestion.nwv === "want" || row.suggestion.nwv === "vice";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected && document.activeElement?.closest(".review-list")) ref.current?.focus({ preventScroll: false }); }, [selected]);
  return (
    <div className={`review-row-wrap ${selected ? "selected" : ""}`} role="listitem">
      <div className="swipe-bg" aria-hidden="true" data-dir={dx > 0 ? "right" : dx < 0 ? "left" : ""}><span>✓ Confirm</span><span>Change ✎</span></div>
      <div ref={ref} className="review-row" tabIndex={selected ? 0 : -1} aria-label={label} aria-current={selected ? "true" : undefined} data-tx={t.id}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined} onClick={onSelect} onFocus={onSelect} {...handlers}>
        <span className="dot" style={{ background: CATEGORY_COLORS[row.suggestion.category] ?? "var(--lk-text-muted)" }} />
        <div className="grow">
          <div className="title">{merchant}</div>
          <div className="sub chips-line">
            <span className="cat-chip">{titleCase(row.suggestion.category)}</span>
            <NwvChip nwv={row.suggestion.nwv} />
            {ratable && <WorthChips id={t.id} worth={worth} onRate={onRate} />}
          </div>
        </div>
        <div className={`amt ${row.refund ? "refund-amt" : ""}`}>{amount}</div>
        <div className="review-actions">
          <button type="button" className="act confirm" aria-label={`Confirm ${merchant}`} title="Confirm (Enter)" onClick={(e) => { e.stopPropagation(); act({ type: "confirm", tx: t.id }); }}><Icon name="check" size={18} /><span>Confirm</span></button>
          {!row.refund && <button type="button" className={`act change ${editing ? "on" : ""}`} aria-label={`Change category for ${merchant}`} aria-expanded={editing} title="Change (E)" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎<span>Change</span></button>}
          {!row.older && <button type="button" className="act skip" aria-label={`Skip ${merchant} for now`} title="Skip (S)" onClick={(e) => { e.stopPropagation(); act({ type: "skip", tx: t.id }); }}>⤓<span>Skip</span></button>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 70, hue: ["var(--lk-gold)", "var(--lk-lotus)", "var(--lk-indigo)", "var(--lk-success)"][i % 4], rot: (i * 53) % 360 })), []);
  return <div className="confetti" aria-hidden="true">{pieces.map((p, i) => <i key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}ms`, background: p.hue, transform: `rotate(${p.rot}deg)` }} />)}</div>;
}

function ReviewView() {
  const { review, source } = useData();
  const { inbox, state, now, dispatch, undo, undoEntry } = review;
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia("(min-width: 900px)").matches, () => false);
  const prefsRaw = useSyncExternalStore(subscribePrefs, () => localStorage.getItem(PREFS_KEY) ?? "", () => "");
  const prefs = useMemo(() => { void prefsRaw; return readPrefs(); }, [prefsRaw]);
  const [expired, setExpired] = useState<number | null>(null);
  const rows = inbox.rows;
  const current = rows[Math.min(sel, rows.length - 1)];
  const { totalXP } = useGame();
  const lvl = levelFor(totalXP);
  const weekXP = state.weekXP[inbox.week] ?? 0;
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!undoEntry) return;
    const t = window.setTimeout(() => setExpired(undoEntry.at), RULES.undoSeconds * 1000);
    return () => window.clearTimeout(t);
  }, [undoEntry]);

  const act = useCallback((a: ReviewAction) => {
    const r = dispatch(a);
    if (a.type !== "rate") setEditing(null);
    setAnnounce(r.message);
    if (r.cleared) setCelebrate(true);
  }, [dispatch]);
  const rate = useCallback((id: string, w: Worth | null) => act({ type: "rate", tx: id, worth: w }), [act]);
  const doUndo = useCallback(() => { const m = undo(); if (m) setAnnounce(m); }, [undo]);

  // Keyboard: J/K/↑/↓ move, Enter confirm, E change, 1/2/3 NWV+confirm, S skip, W/Q worth, Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Enter confirm all, Esc exits.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input,textarea,select,[contenteditable]") || el.closest(".review-editor")) return;
      if (!root.current?.contains(el) && el !== document.body) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); doUndo(); return; }
      if (mod && e.shiftKey && e.key === "Enter") { e.preventDefault(); setConfirmAll(true); return; }
      if (mod || e.altKey) return;
      if (e.key === "Escape") { if (editing) setEditing(null); else (document.activeElement as HTMLElement | null)?.blur(); return; }
      if (!current) return;
      const focusRow = (i: number) => { setSel(i); window.setTimeout(() => root.current?.querySelector<HTMLElement>(`.review-row[data-tx="${rows[i]?.tx.id}"]`)?.focus(), 0); };
      if (k === "j" || e.key === "ArrowDown") { e.preventDefault(); focusRow(Math.min(rows.length - 1, sel + 1)); }
      else if (k === "k" || e.key === "ArrowUp") { e.preventDefault(); focusRow(Math.max(0, sel - 1)); }
      else if (e.key === "Enter" && !el.closest("button")) { e.preventDefault(); act({ type: "confirm", tx: current.tx.id }); }
      else if (k === "e" && !current.refund) { e.preventDefault(); setEditing(current.tx.id); }
      else if (k === "s") { e.preventDefault(); act({ type: "skip", tx: current.tx.id }); }
      else if (["1", "2", "3"].includes(k) && !current.refund) { e.preventDefault(); act({ type: "confirm", tx: current.tx.id, nwv: (["need", "want", "vice"] as Nwv[])[Number(k) - 1] }); }
      else if ((k === "w" || k === "q") && (current.suggestion.nwv === "want" || current.suggestion.nwv === "vice")) {
        e.preventDefault();
        const w: Worth = k === "w" ? "yes" : "no";
        rate(current.tx.id, state.worth[current.tx.id] === w ? null : w);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, rows, sel, editing, act, rate, doUndo, state.worth]);

  const days = useMemo(() => {
    const out: { date: string; rows: { row: InboxRow; index: number }[] }[] = [];
    rows.forEach((row, index) => {
      const last = out[out.length - 1];
      if (last && last.date === row.tx.date && !state.skipped.includes(row.tx.id)) last.rows.push({ row, index });
      else out.push({ date: state.skipped.includes(row.tx.id) ? "skipped" : row.tx.date, rows: [{ row, index }] });
    });
    return out.reduce<typeof out>((acc, d) => { const prev = acc[acc.length - 1]; if (prev && prev.date === d.date) prev.rows.push(...d.rows); else acc.push(d); return acc; }, []);
  }, [rows, state.skipped]);

  const save = (row: InboxRow) => (c: Category, n: Nwv | null, remember: boolean) => act({ type: "change", tx: row.tx.id, category: c, nwv: n, rememberMerchant: remember });
  const setReminder = (on: boolean) => { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, reminder: on })); window.dispatchEvent(new Event("lk-review-prefs")); };
  const showUndo = !!undoEntry && expired !== undoEntry.at;

  return (
    <div ref={root} className="review-page">
      <PageHeader title="Weekly review" subtitle={`Week ${weekNumber(inbox.week)} · ${inbox.count ? `${countLabel(inbox.count)} to review` : "all caught up"}${source === "demo" ? " · demo week" : ""}`}>
        <span className="streak-pill">{streakText(state, now)}</span>
      </PageHeader>

      <Glass className="card review-hero">
        <div className="review-hero-grid">
        <div className="review-hero-main">
          <p className="eyebrow">Only what&apos;s new since your last review</p>
          <p className="review-big">{inbox.count ? <>{countLabel(inbox.count)} <span>to review</span></> : <>Inbox zero <span>✨</span></>}</p>
          {source === "demo" && <button className="btn ghost" type="button" onClick={() => review.resetDemo()}>Reset demo</button>}
          <p className="muted tiny">Confirm +{RULES.xp.confirm} · Change +{RULES.xp.change} · Clear the week +{RULES.xp.weekCleared} and a streak bonus. Up to {RULES.xp.weeklyCap} XP a week.</p>
        </div>
        <div className="review-hero-side">
          <div className="xp-ring" style={{ "--p": `${Math.round(lvl.progress * 100)}%` } as React.CSSProperties}>
            <div><b>Lv {lvl.current.level}</b><small>{lvl.current.name}</small></div>
          </div>
          <p className="tiny muted">{totalXP} XP{lvl.next ? ` · ${lvl.next.minXP - totalXP} to ${lvl.next.name}` : ""}<br />This week {weekXP}/{RULES.xp.weeklyCap}</p>
        </div>
        {inbox.count > 1 && (
          <div className="confirm-all">
            {!confirmAll
              ? <button className="btn ghost" onClick={() => setConfirmAll(true)} title="Ctrl+Shift+Enter">Confirm all remaining</button>
              : <div className="confirm-check" role="group" aria-label="Confirm all">
                  <span>Confirm {inbox.count} items?</span>
                  <button className="btn primary" onClick={() => { setConfirmAll(false); act({ type: "confirmAll" }); }}>Yes, confirm {inbox.count}</button>
                  <button className="btn ghost" onClick={() => setConfirmAll(false)}>Cancel</button>
                </div>}
          </div>
        )}
        </div>
      </Glass>

      {celebrate && inbox.count === 0 && (
        <Glass className="card celebrate" >
          {!reduced && <Confetti />}
          <h2>Inbox zero. Week {weekNumber(inbox.week)} done ✨</h2>
          <p className="muted">{streakText(state, now)}. See you next week.</p>
          {!prefs.reminder && <div className="row-actions"><span className="tiny muted">Want a Sunday nudge?</span><button className="btn ghost" onClick={() => setReminder(true)}>Remind me on Sundays</button></div>}
        </Glass>
      )}

      <div className={`review-layout ${wide ? "wide" : ""}`}>
        <Glass className="card review-list-card">
          {rows.length === 0 ? (
            <div className="review-empty"><span aria-hidden="true">🪷</span><h2>All caught up</h2><p className="muted">New spends will land here. Nothing to do until then.</p></div>
          ) : (
            <div className="review-list" role="list" aria-label={`${inbox.count} to review`}>
              {days.map((d) => (
                <div key={d.date} className="review-day" role="presentation">
                  <h3 className="day-head">{d.date === "skipped" ? "Skipped for later" : formatDate(d.date)}</h3>
                  {d.rows.map(({ row, index }) => (
                    <Row key={row.tx.id} row={row} selected={index === sel} editing={editing === row.tx.id} worth={state.worth[row.tx.id]}
                      onSelect={() => setSel(index)} act={act} onEdit={() => { setSel(index); setEditing(editing === row.tx.id ? null : row.tx.id); }} onRate={rate}>
                      {!wide && editing === row.tx.id && <Editor row={row} onSave={save(row)} onCancel={() => setEditing(null)} />}
                    </Row>
                  ))}
                </div>
              ))}
            </div>
          )}
          {inbox.older.length > 0 && (
            <details className="older">
              <summary>Older imports ({inbox.older.length}) · no XP</summary>
              <div className="review-list" role="list">
                {inbox.older.map((row) => <Row key={row.tx.id} row={row} selected={false} editing={editing === row.tx.id} worth={state.worth[row.tx.id]} onSelect={() => undefined} act={act} onEdit={() => setEditing(editing === row.tx.id ? null : row.tx.id)} onRate={rate}>
                  {editing === row.tx.id && <Editor row={row} onSave={save(row)} onCancel={() => setEditing(null)} />}
                </Row>)}
              </div>
            </details>
          )}
        </Glass>

        {wide && (
          <div className="review-side">
            {current && (
              <Glass className="card review-detail">
                <p className="eyebrow">{formatDate(current.tx.date)} · {current.tx.method?.toUpperCase() ?? ""}</p>
                <h2>{current.tx.merchant ?? current.tx.description}</h2>
                <p className="review-detail-amt">{formatINR(current.tx.amount, { decimals: true, signed: current.refund })}</p>
                <p className="muted tiny">{current.tx.description}</p>
                <div className="chips-line"><span className="cat-chip">{titleCase(current.suggestion.category)}</span><NwvChip nwv={current.suggestion.nwv} /></div>
                {editing === current.tx.id
                  ? <Editor key={current.tx.id} row={current} onSave={save(current)} onCancel={() => setEditing(null)} />
                  : <div className="row-actions">
                      <button className="btn primary" onClick={() => act({ type: "confirm", tx: current.tx.id })}>Confirm · +{RULES.xp.confirm}</button>
                      {!current.refund && <button className="btn ghost" onClick={() => setEditing(current.tx.id)}>Change</button>}
                    </div>}
                <p className="kbd-help tiny muted"><kbd>J</kbd>/<kbd>K</kbd> move · <kbd>Enter</kbd> confirm · <kbd>E</kbd> change · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Need/Want/Vice · <kbd>S</kbd> skip · <kbd>W</kbd>/<kbd>Q</kbd> worth it · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</p>
              </Glass>
            )}
            <Glass className="card"><WorthItCard /></Glass>
          </div>
        )}
      </div>
      {!wide && <Glass className="card"><WorthItCard /></Glass>}

      <Glass className="card review-settings">
        <div className="toggle-row">
          <div><b>Sunday reminder</b><p className="muted tiny">Shows a card on Sunday when there is something to review. Not now hides it for 7 days. On this device only. Nothing is sent.</p></div>
          <Switch checked={prefs.reminder} onChange={setReminder} label="Sunday reminder" />
        </div>
        {source === "demo" && <p className="tiny muted">Demo week: the clock is set to the evening of the demo data&apos;s last day. <button className="linkish" onClick={review.resetDemo}>Reset demo review</button></p>}
        <p className="tiny muted">Your decisions are encrypted and stay on this device. <Link href="/spend/">Back to Spend</Link></p>
      </Glass>

      <div className="sr-only" aria-live="polite" role="status">{announce}</div>
      {showUndo && undoEntry && (
        <div className="toast glass review-toast" role="status">
          <span>{undoEntry.message}</span>
          <button className="btn ghost" onClick={doUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return <DataGate title="Weekly review"><ReviewView /></DataGate>;
}
