// Turns badge facts + app state into nudge candidates (pure). Each candidate carries the numbers its "Why?" needs.
import type { Reward } from "./schema.gen";
import { matchesSet, nextUp, badgeById, TIER_META, isSingleTier, type BadgeEval, type Facts } from "./badges";

const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const pct0 = (x: number) => `${Math.round(x * 100)}%`;
const titleCat = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
import type { Candidate } from "./nudges";

export function historyDays(f: Facts): number {
  return f.firstDate ? Math.round((Date.parse(f.asOf) - Date.parse(f.firstDate)) / 86400000) + 1 : 0;
}

/** Roast rests when the last two complete months were both over budget. */
export function roastOff(f: Facts): boolean {
  const last = f.months.slice(-2);
  if (last.length < 2) return false;
  return last.every((m) => {
    const bs = f.budgets.filter((b) => b.month === m);
    if (!bs.length) return false;
    const cats = new Set(bs.map((b) => b.category));
    const spent = f.variable.reduce((s, t) => (t.date.startsWith(m) && cats.has(t.category) ? s - t.amount : s), 0);
    return spent > bs.reduce((s, b) => s + b.limit, 0);
  });
}

export function buildCandidates(f: Facts, evals: readonly BadgeEval[], reviewCount: number, rewards: readonly Reward[]): Candidate[] {
  const out: Candidate[] = [];
  const month = f.today.slice(0, 7);
  const day = Number(f.today.slice(8, 10));
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const elapsed = day / dim;
  const mtd = (pred: (c: string) => boolean) => f.variable.reduce((s, t) => (t.date.startsWith(month) && pred(t.category) ? s - t.amount : s), 0);

  // pace_over: the budgeted category furthest ahead of the calendar.
  let worst: Candidate | null = null;
  let worstGap = 0;
  for (const b of f.budgets.filter((x) => x.month === month)) {
    const spent = mtd((c) => c === b.category);
    const used = b.limit ? spent / b.limit : 0;
    const gap = used - elapsed;
    if (used >= 0.5 && gap > 0.2 && gap > worstGap) {
      worstGap = gap;
      worst = { id: "pace_over", subject: b.category, vars: { category: titleCat(b.category), usedPct: pct0(used), day, dim }, money: { spent, budget: b.limit } };
    }
  }
  if (worst) out.push(worst);

  // pace_under: month-to-date variable spend well under the usual month.
  const usual = median(f.months.slice(-3).map((mm) => f.variable.reduce((s, t) => (t.date.startsWith(mm) ? s - t.amount : s), 0)));
  if (day >= 7 && usual > 0 && f.months.length >= 2) {
    const spent = mtd(() => true);
    const used = spent / usual;
    if (used < elapsed - 0.15) out.push({ id: "pace_under", subject: month, vars: { usedPct: pct0(used), day, dim }, money: { spent, usual } });
  }

  // near_badge: the closest badge tier (>= 60%).
  const top = nextUp(evals, 0.6, 1)[0];
  if (top) {
    const b = badgeById(top.id)!;
    out.push({ id: "near_badge", subject: `${top.id}:${top.tier}`, vars: { badge: b.name, tier: isSingleTier(b) ? "" : TIER_META[top.tier].label.toLowerCase(), pct: pct0(top.pct), emoji: b.emoji, hint: `${top.hint}.` } });
  }

  // review_waiting
  if (reviewCount >= 5) out.push({ id: "review_waiting", subject: f.today, vars: { count: reviewCount } });

  // delivery_burst: 3+ orders in 7 days and at least double the usual week.
  const from = addDays(f.asOf, -6);
  const recent = f.transactions.filter((t) => t.amount < 0 && t.date >= from && t.date <= f.asOf && matchesSet(t, "food_delivery"));
  if (recent.length >= 3) {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const end = addDays(from, -1 - i * 7), start = addDays(end, -6);
      return f.transactions.reduce((s, t) => (t.amount < 0 && t.date >= start && t.date <= end && matchesSet(t, "food_delivery") ? s - t.amount : s), 0);
    });
    const usualWeek = median(weeks);
    const spent = recent.reduce((s, t) => s - t.amount, 0);
    if (spent >= usualWeek * 2) out.push({ id: "delivery_burst", subject: from, vars: { count: recent.length }, money: { spent, usual: usualWeek } });
  }

  // points_expiring within 45 days.
  for (const r of rewards) {
    if (!r.expiresOn) continue;
    const days = Math.round((Date.parse(r.expiresOn) - Date.parse(f.today)) / 86400000);
    if (days >= 0 && days <= 45) out.push({ id: "points_expiring", subject: r.id, vars: { program: r.program, date: r.expiresOn, days } });
  }
  return out;
}
