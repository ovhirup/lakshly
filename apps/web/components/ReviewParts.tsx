"use client";
// Shared weekly-review pieces: entry card (Overview), count chip (Spend/nav), Worth-it month card.
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useData } from "./DataState";
import { LevelLine } from "./Game";
import { Glass } from "./ui";
import { useTier } from "./useTier";
import { countLabel, localDate, monthlyRatio, questFor, questWaiting, regretMerchants, showSundayReminder, streakText, sundayReminderOn, sundaySnoozed, weekNumber, wishlistUntil, type ReviewTxn } from "@/lib/review";
import { formatMonth, formatPct } from "@/lib/format";

export function ReviewCountBadge({ className = "" }: { className?: string }) {
  const { review } = useData();
  const n = review.inbox.count;
  if (!n) return null;
  return <span className={`review-count ${className}`} data-source-hint="" aria-label={`${n} to review`}>{countLabel(n)}</span>;
}

export function ReviewChip() {
  const { review } = useData();
  const n = review.inbox.count;
  return (
    <Link href="/review/" className="review-chip">
      {n ? <><b>{countLabel(n)}</b> to review</> : <>Inbox zero ✨</>}<span aria-hidden="true"> →</span>
    </Link>
  );
}

export function ReviewEntryCard() {
  const { review } = useData();
  const { inbox, state, now } = review;
  return (
    <div className="review-entry">
      <div>
        <p className="eyebrow">This week · Week {weekNumber(inbox.week)}</p>
        <h2>{inbox.count ? `${countLabel(inbox.count)} to review` : "Inbox zero ✨"}</h2>
        <p className="muted tiny">{streakText(state, now)} · <LevelLine /></p>
      </div>
      <Link className="btn primary" href="/review/">{inbox.count ? "Review" : "Open review"}</Link>
    </div>
  );
}

/** In-app Sunday card. No push, and nothing leaves this device. */
const PREFS_KEY = "lk-review-prefs";
const PREFS_EVENT = "lk-review-prefs";
const SNOOZE_KEY = "lakshly.review.sunday.until";
function subscribe(l: () => void) {
  window.addEventListener("storage", l);
  window.addEventListener(PREFS_EVENT, l);
  return () => { window.removeEventListener("storage", l); window.removeEventListener(PREFS_EVENT, l); };
}
type SundaySnap = { day: number; enabled: boolean; snoozed: boolean };
const SERVER_SNAP: SundaySnap = { day: 1, enabled: true, snoozed: false };
let snapCache = SERVER_SNAP;
function readSnap(): SundaySnap {
  let enabled = true;
  let until: string | null = null;
  try { enabled = sundayReminderOn(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}").reminder); } catch { enabled = true; }
  try { until = localStorage.getItem(SNOOZE_KEY); } catch { until = null; }
  const now = new Date();
  const next = { day: now.getDay(), enabled, snoozed: sundaySnoozed(until, now.getTime()) };
  if (snapCache.day === next.day && snapCache.enabled === next.enabled && snapCache.snoozed === next.snoozed) return snapCache;
  snapCache = next;
  return snapCache;
}
function snoozeSunday() {
  try { localStorage.setItem(SNOOZE_KEY, new Date(Date.now() + 7 * 86400000).toISOString()); } catch { /* ignore */ }
  window.dispatchEvent(new Event(PREFS_EVENT));
}
export function useSundayToday(): { count: number } | null {
  const { can } = useTier();
  const { review } = useData();
  const snap = useSyncExternalStore(subscribe, readSnap, () => SERVER_SNAP);
  if (!can("review.reminder") || !showSundayReminder(snap.day, review.inbox.count, snap.enabled, snap.snoozed)) return null;
  return { count: review.inbox.count };
}

export function SundayBanner({ row = false }: { row?: boolean }) {
  const item = useSundayToday();
  if (!item) return null;
  const body = (
    <>
      {row ? <h3>Sunday review</h3> : null}
      <p>{countLabel(item.count)} to review. A weekly check on this device. Nothing is sent.</p>
      <div className="row-actions">
        <Link className="btn primary" href="/review/">Review</Link>
        <button className="btn ghost" type="button" onClick={snoozeSunday}>Not now</button>
      </div>
    </>
  );
  if (row) return <div className="today-row">{body}</div>;
  return (
    <Glass className="card sunday-banner">
      <div className="card-head"><h2>Sunday review</h2></div>
      {body}
    </Glass>
  );
}

// --- Worth-it month card -------------------------------------------------------------------------------------------

let questDayCache = "1970-01-01";
function readQuestDay() {
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  if (questDayCache === today) return questDayCache;
  questDayCache = today;
  return questDayCache;
}

export function useQuestToday(): { waiting: boolean; merchant: string; until: string } | null {
  const { review } = useData();
  const today = useSyncExternalStore(() => () => {}, readQuestDay, () => questDayCache);
  const quest = review.state.quest;
  if (!quest) return null;
  return { waiting: questWaiting(quest, today), merchant: quest.merchant, until: quest.until };
}

export function latestRatedMonth(txns: readonly ReviewTxn[], worth: Record<string, string>): string | null {
  let m: string | null = null;
  for (const t of txns) if (worth[t.id] && (!m || t.date.slice(0, 7) > m)) m = t.date.slice(0, 7);
  return m;
}

export function WorthItCard({ compact = false }: { compact?: boolean }) {
  const { review, rawTransactions } = useData();
  const { tier } = useTier();
  const txns = rawTransactions as ReviewTxn[];
  const { state, now } = review;
  const month = latestRatedMonth(txns, state.worth) ?? localDate(now).slice(0, 7);
  const ratio = useMemo(() => monthlyRatio(txns, state, month), [txns, state, month]);
  const regrets = useMemo(() => regretMerchants(txns, state, now), [txns, state, now]);
  const snoozed = (m: string) => { const u = state.snoozed?.[m]; return !!u && Date.parse(u) > now.getTime(); };
  const regret = ratio.ratio !== null ? regrets.find((m) => !snoozed(m)) : undefined;
  const cat = regret ? txns.find((t) => (t.merchant ?? t.description) === regret)?.category : undefined;
  const quest = regret ? questFor(regret, cat, tier === "premium") : null;
  // Snoozes live in the encrypted review record (merchant names are derived from imported data).
  const notNow = (m: string) => { review.dispatch({ type: "snooze", merchant: m, until: new Date(now.getTime() + 30 * 86400000).toISOString() }); };
  const noCount = regret ? txns.filter((t) => (t.merchant ?? t.description) === regret && state.worth[t.id] === "no").length : 0;
  const canStart = !!regret && !!quest && (quest.id === "wishlist_three" || quest.id === "custom");
  return (
    <div className={`worth-card ${compact ? "compact" : ""}`}>
      <div className="worth-head">
        <span className="worth-icon" aria-hidden="true">👍👎</span>
        <div>
          <p className="eyebrow">Worth-it ratio · {formatMonth(month, true)}</p>
          {ratio.ratio === null
            ? <p className="worth-big">{ratio.rated ? `${ratio.rated} rated` : "Not rated yet"}<span className="muted tiny"> · Rate a few more to see your ratio</span></p>
            : <p className="worth-big">{formatPct(ratio.ratio * 100, 0)} <span className="muted tiny">({ratio.rated} rated)</span></p>}
        </div>
      </div>
      {!compact && <p className="muted tiny">Tap 👍 or 👎 on Wants and Vices while you review. No XP, no judgement: it&apos;s just for you.</p>}
      {!state.quest && regret && quest && (
        <div className="worth-suggest">
          <p>You&apos;ve said &lsquo;not really&rsquo; to <b>{regret}</b> {noCount} times. Try {quest.title}?{quest.premium ? <span className="badge premium small" style={{ marginLeft: 6 }}>✦ Premium</span> : null}</p>
          <div className="row-actions">
            {canStart && <button className="btn primary" type="button" onClick={() => review.dispatch({ type: "startQuest", merchant: regret, until: wishlistUntil(readQuestDay()) })}>Start the 3-day wait</button>}
            <button className="btn ghost" type="button" onClick={() => notNow(regret)}>Not now</button>
          </div>
          <p className="muted tiny">{canStart ? "On this device. Nothing is sent." : "Quests are coming soon. We only ever suggest one for merchants you said you regret."}</p>
        </div>
      )}
    </div>
  );
}
