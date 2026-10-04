"use client";
// Shared weekly-review pieces: entry card (Overview), count chip (Spend/nav), Worth-it month card.
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { useData } from "./DataState";
import { LevelLine } from "./Game";
import { useTier } from "./useTier";
import { countLabel, localDate, monthlyRatio, questFor, regretMerchants, streakText, weekNumber, type ReviewTxn } from "@/lib/review";
import { formatMonth, formatPct } from "@/lib/format";

export function ReviewCountBadge({ className = "" }: { className?: string }) {
  const { review } = useData();
  const n = review.inbox.count;
  if (!n) return null;
  return <span className={`review-count ${className}`} aria-label={`${n} to review`}>{countLabel(n)}</span>;
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

/** Opt-in Sunday-evening banner (web has no push; reminders are in-app only). */
const PREFS_KEY = "lk-review-prefs";
const subscribe = (l: () => void) => { const ev = ["storage", PREFS_KEY]; ev.forEach((e) => window.addEventListener(e, l)); return () => ev.forEach((e) => window.removeEventListener(e, l)); };
const readReminder = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}").reminder === true; } catch { return false; } };
export function SundayBanner() {
  const { review } = useData();
  const on = useSyncExternalStore(subscribe, readReminder, () => false);
  const n = review.now;
  if (!on || n.getDay() !== 0 || n.getHours() < 17 || !review.inbox.count) return null;
  return <div className="sunday-banner glass"><span>🌙 Sunday review: {countLabel(review.inbox.count)} waiting · {streakText(review.state, n)}</span><Link className="btn primary" href="/review/">Review now</Link></div>;
}

// --- Worth-it month card -------------------------------------------------------------------------------------------

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
      {regret && quest && (
        <div className="worth-suggest">
          <p>You&apos;ve said &lsquo;not really&rsquo; to <b>{regret}</b> {noCount} times. Try {quest.title}?{quest.premium ? <span className="badge premium small" style={{ marginLeft: 6 }}>✦ Premium</span> : null}</p>
          <div className="row-actions">
            <button className="btn ghost" onClick={() => notNow(regret)}>Not now</button>
          </div>
          <p className="muted tiny">Quests are coming soon. We only ever suggest one for merchants you said you regret.</p>
        </div>
      )}
    </div>
  );
}
