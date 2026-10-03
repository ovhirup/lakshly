// Badge engine (pure): facts -> evaluate -> append-only ledger -> XP -> cabinet.
// Badges reward money moving the right way. Nothing here reads the user's plan/tier: Premium can't buy XP or badges.
import type { Account, Budget, Category, Debt, Sip } from "./schema.gen";
import { BADGE_RULES_JSON } from "./game.gen";
import { isoWeek, localDate, weekMonday, type Nwv, type ReviewTxn } from "./review";

export type Tier = "bronze" | "silver" | "gold";
export const TIER_META: Readonly<Record<Tier, { label: string; medal: string }>> = {
  bronze: { label: "Bronze", medal: "🥉" }, silver: { label: "Silver", medal: "🥈" }, gold: { label: "Gold", medal: "🥇" },
};
type Params = Record<string, number>;
export interface BadgeRule {
  id: string; name: string; family: string; emoji: string; perEntity?: boolean;
  tiers: { tier: Tier; xp: number; params: Params }[];
  rule: { type: string; [k: string]: unknown };
  copy: { rule: string; hint: string };
}
export interface BadgeRules {
  version: number;
  xp: { weeklyCap: number; historyBonusCap: number; premiumCanBuy: false };
  defaults: { variableExcludes: Category[]; excludeTags: string[]; baseline: { months: number; minMonths: number } };
  merchantSets: Record<string, { category: Category; pattern: string }>;
  families: { id: string; label: string }[];
  badges: BadgeRule[];
}
export const RULES: BadgeRules = BADGE_RULES_JSON as unknown as BadgeRules;

/** Evidence keeps money as numbers so it renders through the (privacy-aware) formatter. Placeholders: {a}, {b}… */
export interface Evidence { t: string; money?: Record<string, number> }
export interface Unlock { id: string; tier: Tier; entity?: string; date: string; evidence: Evidence; xp: number }
export interface Progress { id: string; tier: Tier; entity?: string; pct: number; hint: string }
export interface BadgeEval { id: string; earned: Unlock[]; next: Progress | null; evaluable: boolean; note?: string }

// ---------------- facts ----------------
export interface FactsInput {
  transactions: readonly ReviewTxn[];
  budgets: readonly Budget[];
  debts: readonly Debt[];
  sips: readonly Sip[];
  accounts: readonly Account[];
  clearedWeeks: readonly string[];
  /** Effective Need/Want/Vice for a row (review decision, then suggestion). */
  nwvOf: (t: ReviewTxn) => Nwv | null;
  now: Date;
}
export interface Facts extends FactsInput {
  today: string;
  /** Data is complete through yesterday. */
  asOf: string;
  firstDate: string | null;
  /** Complete months (before today's month) that have at least one transaction, oldest first. */
  months: string[];
  variable: ReviewTxn[];
}

const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const monthEnd = (m: string) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const pct0 = (x: number) => `${Math.round(x * 100)}%`;
const titleCat = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export function buildFacts(input: FactsInput): Facts {
  const today = localDate(input.now);
  const asOf = addDays(today, -1);
  const tx = input.transactions.filter((t) => t.date <= asOf);
  const firstDate = tx.reduce<string | null>((m, t) => (!m || t.date < m ? t.date : m), null);
  const cur = today.slice(0, 7);
  const months = [...new Set(tx.map((t) => t.date.slice(0, 7)))].filter((m) => m < cur).sort();
  const ex = new Set(RULES.defaults.variableExcludes);
  const tags = new Set(RULES.defaults.excludeTags);
  const variable = tx.filter((t) => t.amount < 0 && !ex.has(t.category) && !(t.tags ?? []).some((g) => tags.has(g)));
  return { ...input, transactions: tx, today, asOf, firstDate, months, variable };
}

const spendIn = (f: Facts, m: string, pred: (t: ReviewTxn) => boolean = () => true) =>
  f.variable.reduce((s, t) => (t.date.startsWith(m) && pred(t) ? s - t.amount : s), 0);

function baseline(f: Facts, metric: (m: string) => number, idx: number): number | null {
  const prev = f.months.slice(Math.max(0, idx - RULES.defaults.baseline.months), idx);
  return prev.length < RULES.defaults.baseline.minMonths ? null : median(prev.map(metric));
}

export function matchesSet(t: ReviewTxn, set: string): boolean {
  const s = RULES.merchantSets[set];
  return !!s && t.category === s.category && new RegExp(s.pattern, "i").test(`${t.merchant ?? ""} ${t.description}`);
}

// ---------------- evaluators ----------------
type Ev = (b: BadgeRule, f: Facts) => Omit<BadgeEval, "id">;
const unlock = (b: BadgeRule, tier: Tier, date: string, evidence: Evidence, entity?: string): Unlock =>
  ({ id: b.id, tier, date, evidence, xp: b.tiers.find((t) => t.tier === tier)!.xp, ...(entity ? { entity } : {}) });
const nextTier = (b: BadgeRule, earned: Unlock[], entity?: string) => b.tiers.find((t) => !earned.some((u) => u.tier === t.tier && u.entity === entity));

function consecutive(b: BadgeRule, f: Facts, pass: (m: string, i: number) => boolean | null, evidence: (m: string) => Evidence, freezesOf: (p: Params) => number): Omit<BadgeEval, "id"> {
  const earned: Unlock[] = [];
  let bestRunNow = 0;
  let any = false;
  for (const t of b.tiers) {
    let run = 0;
    let freezes = freezesOf(t.params);
    const maxFreezes = freezes;
    f.months.forEach((m, i) => {
      const r = pass(m, i);
      if (r === null) return; // not evaluable: like a frozen month, without using the freeze
      any = true;
      if (r) {
        run += 1;
        if (run >= t.params.n && !earned.some((u) => u.tier === t.tier)) earned.push(unlock(b, t.tier, monthEnd(m), evidence(m)));
      } else if (run > 0 && freezes > 0) freezes -= 1;
      else { run = 0; freezes = maxFreezes; }
    });
    if (!earned.some((u) => u.tier === t.tier)) bestRunNow = Math.max(bestRunNow, run);
  }
  const nt = nextTier(b, earned);
  return {
    earned, evaluable: any, note: any ? undefined : "Needs a complete month of data",
    next: nt ? { id: b.id, tier: nt.tier, pct: Math.min(0.99, bestRunNow / nt.params.n), hint: `${Math.max(1, nt.params.n - bestRunNow)} more month${nt.params.n - bestRunNow === 1 ? "" : "s"} in a row` } : null,
  };
}

const EVALUATORS: Record<string, Ev> = {
  consecutive_months_under_budget: (b, f) => {
    const totals = (m: string) => spendIn(f, m);
    return consecutive(b, f, (m, i) => {
      const bs = f.budgets.filter((x) => x.month === m);
      if (bs.length) {
        const cats = new Set(bs.map((x) => x.category));
        return spendIn(f, m, (t) => cats.has(t.category)) <= bs.reduce((s, x) => s + x.limit, 0);
      }
      const base = baseline(f, totals, i);
      return base === null ? null : totals(m) <= base;
    }, (m): Evidence => {
      const bs = f.budgets.filter((x) => x.month === m);
      const cats = new Set(bs.map((x) => x.category));
      return bs.length
        ? { t: `${monthLabel(m)}: budgeted spending {a} vs budgets {b}.`, money: { a: spendIn(f, m, (t) => cats.has(t.category)), b: bs.reduce((s, x) => s + x.limit, 0) } }
        : { t: `${monthLabel(m)}: variable spend {a}, at or under your usual.`, money: { a: totals(m) } };
    }, () => Number(b.rule.freezes ?? 0));
  },

  category_tamer: (b, f) => {
    const p = b.tiers[0].params;
    const total = (m: string) => spendIn(f, m);
    let evaluable = false;
    for (let i = 0; i < f.months.length; i += 1) {
      const m = f.months[i];
      const base = baseline(f, total, i);
      if (base === null) continue;
      evaluable = true;
      if (total(m) > base) continue;
      const cats = [...new Set(f.variable.map((t) => t.category))].sort();
      for (const c of cats) {
        const cb = baseline(f, (mm) => spendIn(f, mm, (t) => t.category === c), i);
        const spent = spendIn(f, m, (t) => t.category === c);
        if (cb !== null && cb >= p.minBaseline && spent <= cb * p.factor) {
          return { earned: [unlock(b, "bronze", monthEnd(m), { t: `${monthLabel(m)}: ${titleCat(c)} {a} vs usual {b}, total {c} vs usual {d}.`, money: { a: spent, b: cb, c: total(m), d: base } })], next: null, evaluable: true };
        }
      }
    }
    return { earned: [], evaluable, note: evaluable ? undefined : "Needs 2 months of data", next: evaluable ? { id: b.id, tier: "bronze", pct: 0, hint: b.copy.hint } : null };
  },

  share_of_spend: (b, f) => {
    const nwv = b.rule.nwv as Nwv;
    const minCount = Number(b.rule.minCount ?? 0);
    const earned: Unlock[] = [];
    let best = Infinity;
    let evaluable = false;
    for (const m of f.months) {
      const rows = f.variable.filter((t) => t.date.startsWith(m));
      const tagged = rows.filter((t) => f.nwvOf(t) !== null);
      const wants = tagged.filter((t) => f.nwvOf(t) === nwv);
      const den = tagged.reduce((s, t) => s - t.amount, 0);
      if (wants.length < minCount || !den) continue;
      evaluable = true;
      const share = wants.reduce((s, t) => s - t.amount, 0) / den;
      best = Math.min(best, share);
      for (const t of b.tiers) if (share <= t.params.maxShare && !earned.some((u) => u.tier === t.tier)) earned.push(unlock(b, t.tier, monthEnd(m), { t: `${monthLabel(m)}: Wants were ${pct0(share)} of variable spend.` }));
    }
    const nt = nextTier(b, earned);
    return { earned, evaluable, note: evaluable ? undefined : `Needs a month with ${minCount}+ Wants`, next: nt && evaluable ? { id: b.id, tier: nt.tier, pct: Math.min(0.99, nt.params.maxShare / best), hint: `Wants at ${pct0(nt.params.maxShare)} or less (best so far ${pct0(best)})` } : null };
  },

  zero_run_days: (b, f) => {
    const match = b.rule.match as { nwv?: Nwv; set?: string };
    const hit = (t: ReviewTxn) => t.amount < 0 && (match.set ? matchesSet(t, match.set) : f.nwvOf(t) === match.nwv);
    const days = new Set(f.transactions.filter(hit).map((t) => t.date));
    const earned: Unlock[] = [];
    if (!f.firstDate) return { earned, evaluable: false, note: "Needs some data", next: null };
    let started = !b.rule.needsPriorMatch;
    let run = 0;
    let runStart = f.firstDate;
    for (let d = f.firstDate; d <= f.asOf; d = addDays(d, 1)) {
      if (days.has(d)) { started = true; run = 0; runStart = addDays(d, 1); continue; }
      if (!started) continue;
      run += 1;
      for (const t of b.tiers) if (run >= t.params.days && !earned.some((u) => u.tier === t.tier)) earned.push(unlock(b, t.tier, d, { t: `${t.params.days} clear days in a row, ${runStart} to ${d}.` }));
    }
    const nt = nextTier(b, earned);
    return {
      earned, evaluable: started, note: started ? undefined : "Starts after your first tagged Vice",
      next: nt && started ? { id: b.id, tier: nt.tier, pct: Math.min(0.99, run / nt.params.days), hint: `${nt.params.days - run} more day${nt.params.days - run === 1 ? "" : "s"}` } : null,
    };
  },

  on_time_instalments: (b, f) => {
    const tol = Number(b.rule.tolerancePct ?? 2) / 100;
    const look = Number(b.rule.lookbackDays ?? 31);
    const earned: Unlock[] = [];
    let bestRun = 0;
    let evaluable = false;
    for (const debt of f.debts) {
      if (!debt.emi || !f.firstDate) continue;
      const day = Number(debt.startDate.slice(8, 10));
      let run = 0;
      const used = new Set<string>();
      for (let k = 1; k <= debt.tenureMonths; k += 1) {
        const [y, m] = debt.startDate.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1 + k, 1));
        const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
        const due = `${dt.toISOString().slice(0, 7)}-${String(Math.min(day, last)).padStart(2, "0")}`;
        if (due > f.asOf) break;
        if (due < f.firstDate) continue; // before our data: not evaluable
        evaluable = true;
        const pay = f.transactions.find((t) => !used.has(t.id) && t.amount < 0 && Math.abs(-t.amount - debt.emi) <= debt.emi * tol
          && t.date <= due && dayDiff(t.date, due) < look && (t.category === "emi" || (debt.accountId && t.accountId === debt.accountId) || (!!debt.lender && t.merchant === debt.lender)));
        if (pay) {
          used.add(pay.id);
          run += 1;
          for (const t of b.tiers) if (run >= t.params.n && !earned.some((u) => u.tier === t.tier)) earned.push(unlock(b, t.tier, due, { t: `${t.params.n} ${debt.name} instalments in a row, each paid by its due date (latest {a} on ${pay.date}).`, money: { a: -pay.amount } }));
        } else run = 0;
      }
      bestRun = Math.max(bestRun, run);
    }
    const nt = nextTier(b, earned);
    return { earned, evaluable, note: evaluable ? undefined : "Add a loan with its EMI to track this", next: nt && evaluable ? { id: b.id, tier: nt.tier, pct: Math.min(0.99, bestRun / nt.params.n), hint: `${nt.params.n - bestRun} more on-time EMI${nt.params.n - bestRun === 1 ? "" : "s"}` } : null };
  },

  debt_repaid_pct: (b, f) => {
    const earned: Unlock[] = [];
    let next: Progress | null = null;
    for (const d of f.debts) {
      if (!d.principal) continue;
      const pct = ((d.principal - Math.max(0, d.outstanding)) / d.principal) * 100;
      for (const t of b.tiers) if (pct >= t.params.pct) earned.push(unlock(b, t.tier, f.asOf, { t: `${d.name}: {a} of {b} principal repaid (${Math.floor(pct)}%).`, money: { a: d.principal - Math.max(0, d.outstanding), b: d.principal } }, d.id));
      const nt = nextTier(b, earned, d.id);
      if (nt) {
        const p = Math.min(0.99, pct / nt.params.pct);
        if (!next || p > next.pct) next = { id: b.id, tier: nt.tier, entity: d.id, pct: p, hint: `${d.name}: ${Math.floor(pct)}% repaid of ${nt.params.pct}%` };
      }
    }
    const evaluable = f.debts.some((d) => d.principal > 0);
    return { earned, evaluable, note: evaluable ? undefined : "Add the loan amount to track slices", next };
  },

  debt_closed: (b, f) => {
    const earned = f.debts.filter((d) => d.principal > 0 && d.outstanding <= 0).map((d) => unlock(b, "bronze", f.asOf, { t: `${d.name} is fully repaid.` }, d.id));
    return { earned, evaluable: f.debts.length > 0, note: f.debts.length ? undefined : "Add a loan to track this", next: null };
  },

  sip_months: (b, f) => {
    const win = Number(b.rule.windowDays ?? 5);
    const inv = f.transactions.filter((t) => t.category === "investments" && t.amount < 0);
    return consecutive(b, f, (m) => {
      const end = monthEnd(m);
      const active = f.sips.filter((s) => s.status === "active" && s.startDate <= end);
      if (!active.length) return null;
      const used = new Set<string>();
      return active.every((s) => {
        const last = Number(end.slice(8, 10));
        const due = `${m}-${String(Math.min(s.dayOfMonth, last)).padStart(2, "0")}`;
        const hit = inv.find((t) => !used.has(t.id) && Math.abs(dayDiff(due, t.date)) <= win);
        if (hit) used.add(hit.id);
        return !!hit;
      });
    }, (m) => ({ t: `${monthLabel(m)}: every active SIP went through on schedule.` }), (p) => p.freezes ?? 0);
  },

  emergency_months: (b, f) => {
    const liquid = f.accounts.filter((a) => ["savings", "current", "cash", "fixed_deposit"].includes(a.type)).reduce((s, a) => s + Math.max(0, a.balance), 0);
    const tags = new Set(RULES.defaults.excludeTags);
    const monthTotal = (m: string) => f.transactions.reduce((s, t) => (t.date.startsWith(m) && t.amount < 0 && !["income", "transfers", "investments"].includes(t.category) && !(t.tags ?? []).some((g) => tags.has(g)) ? s - t.amount : s), 0);
    const ms = f.months.slice(-12);
    if (!ms.length) return { earned: [], evaluable: false, note: "Needs a complete month of data", next: null };
    const typical = median(ms.map(monthTotal));
    const ratio = typical ? liquid / typical : 0;
    const earned = b.tiers.filter((t) => ratio >= t.params.months).map((t) => unlock(b, t.tier, f.asOf, { t: `Easy-to-reach money {a} covers ${ratio.toFixed(1)} months of a typical month's spend ({b}).`, money: { a: liquid, b: typical } }));
    const nt = nextTier(b, earned);
    return { earned, evaluable: true, next: nt ? { id: b.id, tier: nt.tier, pct: Math.min(0.99, ratio / nt.params.months), hint: `${ratio.toFixed(1)} of ${nt.params.months} months covered` } : null };
  },

  pay_yourself_first: (b, f) => {
    const p = b.tiers[0].params;
    return consecutive(b, { ...f }, (m) => {
      const salary = f.transactions.filter((t) => t.date.startsWith(m) && t.category === "income" && t.amount >= p.salaryMin).sort((a, c) => a.date.localeCompare(c.date))[0];
      if (!salary) return null;
      return f.transactions.some((t) => t.category === "investments" && t.amount < 0 && dayDiff(salary.date, t.date) >= 0 && dayDiff(salary.date, t.date) <= p.withinDays);
    }, (m) => ({ t: `${monthLabel(m)}: invested within ${p.withinDays} days of payday.` }), () => 0);
  },

  cleared_weeks: (b, f) => {
    const weeks = [...f.clearedWeeks].sort();
    const earned = b.tiers.filter((t) => weeks.length >= t.params.n).map((t) => {
      const w = weeks[t.params.n - 1];
      const sunday = addDays(weekMonday(w), 6);
      return unlock(b, t.tier, sunday < f.today ? sunday : f.today, { t: `${t.params.n} weekly reviews cleared (the ${ordinal(t.params.n)} in week ${Number(w.split("-W")[1])}).` });
    });
    const nt = nextTier(b, earned);
    return { earned, evaluable: true, next: nt ? { id: b.id, tier: nt.tier, pct: Math.min(0.99, weeks.length / nt.params.n), hint: `${nt.params.n - weeks.length} more cleared week${nt.params.n - weeks.length === 1 ? "" : "s"}` } : null };
  },
};
const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
export const RULE_TYPES = Object.keys(EVALUATORS);

export function evaluate(f: Facts, rules: BadgeRules = RULES): BadgeEval[] {
  return rules.badges.map((b) => {
    const ev = EVALUATORS[b.rule.type];
    return ev ? { id: b.id, ...ev(b, f) } : { id: b.id, earned: [], next: null, evaluable: false, note: "Not available yet" };
  });
}

// ---------------- ledger (append-only) ----------------
export interface LedgerEntry { id: string; tier: Tier; entity?: string; date: string; evidence: Evidence; firstSeen: string; xp: number; backfill: boolean }
export interface Ledger { v: 1; firstRunAt: string | null; entries: Record<string, LedgerEntry>; backfillAck: boolean; seen: string[] }
export const emptyLedger = (): Ledger => ({ v: 1, firstRunAt: null, entries: {}, backfillAck: false, seen: [] });
export const ledgerKey = (u: { id: string; tier: Tier; entity?: string }) => `${u.id}:${u.tier}${u.entity ? `:${u.entity}` : ""}`;

export function normaliseLedger(raw: unknown): Ledger {
  if (!raw || typeof raw !== "object") return emptyLedger();
  const r = raw as Partial<Ledger>;
  return { v: 1, firstRunAt: typeof r.firstRunAt === "string" ? r.firstRunAt : null, entries: r.entries && typeof r.entries === "object" ? { ...r.entries } : {}, backfillAck: r.backfillAck === true, seen: Array.isArray(r.seen) ? r.seen : [] };
}

/** Adds unlocks that aren't in the ledger yet. Never removes or rewrites an existing key. */
export function mergeLedger(prev: Ledger, evals: readonly BadgeEval[], today: string): { ledger: Ledger; added: LedgerEntry[] } {
  const firstRun = prev.firstRunAt === null;
  const ledger: Ledger = { ...prev, entries: { ...prev.entries }, firstRunAt: prev.firstRunAt ?? today };
  const added: LedgerEntry[] = [];
  for (const e of evals) for (const u of e.earned) {
    const k = ledgerKey(u);
    if (ledger.entries[k]) continue;
    const entry: LedgerEntry = { ...u, firstSeen: today, backfill: firstRun };
    ledger.entries[k] = entry;
    added.push(entry);
  }
  return { ledger, added };
}

// ---------------- XP ----------------
export interface XpSummary { historyBonus: number; historyEarned: number; paid: number; banked: number; total: number }
/** History unlocks: one bonus capped at 250 (outside the cap). Later unlocks: 80 XP per ISO week, overflow banked FIFO. */
export function applyXp(ledger: Ledger, today: string, rules: BadgeRules = RULES): XpSummary {
  const entries = Object.values(ledger.entries);
  const historyEarned = entries.filter((e) => e.backfill).reduce((s, e) => s + e.xp, 0);
  const historyBonus = Math.min(rules.xp.historyBonusCap, historyEarned);
  const live = entries.filter((e) => !e.backfill).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
  const byWeek = new Map<string, number>();
  for (const e of live) byWeek.set(isoWeek(e.firstSeen), (byWeek.get(isoWeek(e.firstSeen)) ?? 0) + e.xp);
  let bank = 0, paid = 0;
  if (live.length) {
    const end = isoWeek(today);
    for (let w = isoWeek(live[0].firstSeen); w <= end; w = isoWeek(addDays(weekMonday(w), 7))) {
      bank += byWeek.get(w) ?? 0;
      const pay = Math.min(rules.xp.weeklyCap, bank);
      bank -= pay;
      paid += pay;
    }
  }
  return { historyBonus, historyEarned, paid, banked: bank, total: historyBonus + paid };
}

// ---------------- render ----------------
export function renderEvidence(e: Evidence, money: (paise: number) => string): string {
  return e.t.replace(/\{(\w+)\}/g, (_, k: string) => (e.money && k in e.money ? money(e.money[k]) : `{${k}}`));
}
export function ruleText(b: BadgeRule, tier: Tier): string {
  const p = b.tiers.find((t) => t.tier === tier)?.params ?? {};
  return b.copy.rule.replace(/\{(\w+)\}/g, (_, k: string) => (k === "maxSharePct" ? pct0(p.maxShare ?? 0) : String(p[k] ?? "")));
}
export const isSingleTier = (b: BadgeRule) => b.tiers.length === 1;

/** Top progress entries for the "Next up" strip (pct >= 60%). */
export function nextUp(evals: readonly BadgeEval[], min = 0.6, max = 3): Progress[] {
  return evals.map((e) => e.next).filter((p): p is Progress => !!p && p.pct >= min).sort((a, b) => b.pct - a.pct).slice(0, max);
}
export const badgeById = (id: string) => RULES.badges.find((b) => b.id === id);
export const todayOf = (d: Date) => localDate(d);
