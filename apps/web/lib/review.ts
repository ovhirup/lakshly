// Weekly review inbox + Worth-it tags: pure logic (no React, no storage, no network).
// buildInbox(transactions, state, now) decides what needs a look this week;
// applyAction(state, action, ctx) is the single reducer every input path (buttons, swipe, keys) goes through.
import type { Category, Transaction } from "./schema.gen";
import { LEVELS, type Level } from "./levels.gen";

export type Nwv = "need" | "want" | "vice";
export type Worth = "yes" | "no";
/** Review rows can carry the proposed optional `nwv` field; the published schema does not have it yet. */
export type ReviewTxn = Transaction & { nwv?: Nwv };

export const RULES = {
  windowDays: 35,
  firstRunDays: 7,
  xp: { confirm: 1, change: 2, weekCleared: 15, streakBonusPer: 5, streakBonusMaxWeeks: 4, weeklyCap: 60 },
  undoSeconds: 5,
  refillEveryClears: 4,
} as const;

export const CATEGORIES: readonly Category[] = [
  "groceries", "dining", "transport", "fuel", "shopping", "utilities", "rent", "health", "education", "entertainment",
  "travel", "subscriptions", "insurance", "investments", "emi", "fees", "transfers", "cash", "gifts", "other", "income",
];

/** Default Need/Want/Vice suggestion when a row has none. A suggestion only; the user always decides. */
export const NWV_BY_CATEGORY: Readonly<Record<Category, Nwv>> = {
  income: "need", groceries: "need", dining: "want", transport: "need", fuel: "need", shopping: "want", utilities: "need",
  rent: "need", health: "need", education: "need", entertainment: "want", travel: "want", subscriptions: "want",
  insurance: "need", investments: "need", emi: "need", fees: "need", transfers: "need", cash: "want", gifts: "want", other: "want",
};

export const NWV_META: Readonly<Record<Nwv, { label: string; icon: string }>> = {
  need: { label: "Need", icon: "🧺" },
  want: { label: "Want", icon: "✨" },
  vice: { label: "Vice", icon: "🎲" },
};

export interface Decision { category: Category; nwv: Nwv | null; action: "confirm" | "change"; at: string; worth?: Worth }
export interface MerchantRule { category: Category; nwv: Nwv | null }
export interface ReviewState {
  v: 2;
  lastReviewedAt: string | null;
  lastClearedWeek: string | null;
  streak: number;
  bestStreak: number;
  freezesLeft: number;
  /** Cleared weeks since the freeze was last refilled (refills at 4). */
  clearsTowardFreeze: number;
  xp: number;
  weekXP: Record<string, number>;
  decisions: Record<string, Decision>;
  merchantRules: Record<string, MerchantRule>;
  /** Mirror of decisions[tx].worth for quick reads (also holds ratings made outside the review). */
  worth: Record<string, Worth>;
  /** Skipped rows, oldest skip first; they sort to the bottom of the inbox. */
  skipped: string[];
  /** Every ISO week cleared, oldest first (feeds the Inbox Zero badge). */
  clearedWeeks: string[];
}

export const emptyState = (): ReviewState => ({
  v: 2, lastReviewedAt: null, lastClearedWeek: null, streak: 0, bestStreak: 0, freezesLeft: 1, clearsTowardFreeze: 0,
  xp: 0, weekXP: {}, decisions: {}, merchantRules: {}, worth: {}, skipped: [], clearedWeeks: [],
});

/** Accepts v1 (spec) or v2 state, fills gaps defensively. */
export function normaliseState(raw: unknown): ReviewState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<ReviewState>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const obj = <T>(v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T));
  const decisions = obj<Record<string, Decision>>(r.decisions);
  const worth = { ...obj<Record<string, Worth>>(r.worth) };
  for (const [id, d] of Object.entries(decisions)) if (d.worth && !worth[id]) worth[id] = d.worth;
  return {
    v: 2,
    lastReviewedAt: typeof r.lastReviewedAt === "string" ? r.lastReviewedAt : null,
    lastClearedWeek: typeof r.lastClearedWeek === "string" ? r.lastClearedWeek : null,
    streak: num(r.streak, 0), bestStreak: num(r.bestStreak, 0), freezesLeft: num(r.freezesLeft, 1),
    clearsTowardFreeze: num(r.clearsTowardFreeze, 0), xp: num(r.xp, 0),
    weekXP: obj<Record<string, number>>(r.weekXP), decisions, merchantRules: obj<Record<string, MerchantRule>>(r.merchantRules),
    worth, skipped: Array.isArray(r.skipped) ? r.skipped.filter((s) => typeof s === "string") : [],
    clearedWeeks: Array.isArray(r.clearedWeeks) ? r.clearedWeeks.filter((s) => typeof s === "string")
      : typeof r.lastClearedWeek === "string" ? [r.lastClearedWeek] : [],
  };
}

// ---------- dates & ISO weeks (device-local) ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** ISO string with the device's offset, e.g. 2026-10-04T19:00:00+05:30. */
export function isoLocal(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
/** ISO week id (YYYY-Www) of a calendar date string. */
export function isoWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${pad(week)}`;
}
/** Monday of an ISO week id. */
export function weekMonday(id: string): string {
  const [y, w] = id.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() - dow + 1 + (w - 1) * 7);
  return jan4.toISOString().slice(0, 10);
}
export const weeksBetween = (a: string, b: string) =>
  Math.round((Date.parse(weekMonday(b)) - Date.parse(weekMonday(a))) / (7 * 86400000));
export const weekNumber = (id: string) => Number(id.split("-W")[1]);

// ---------- suggestions ----------
export const merchantKey = (t: Pick<Transaction, "merchant" | "description">) => (t.merchant || t.description || "").trim().toLowerCase();
export const isRefund = (t: Transaction) => t.amount > 0 && (t.tags ?? []).includes("refund");

export interface Suggestion { category: Category; nwv: Nwv | null }
export function suggest(t: ReviewTxn, state: ReviewState): Suggestion {
  const rule = state.merchantRules[merchantKey(t)];
  const category = rule?.category ?? t.category;
  if (isRefund(t)) return { category, nwv: null };
  return { category, nwv: rule?.nwv ?? t.nwv ?? NWV_BY_CATEGORY[category] ?? "want" };
}

// ---------- inbox ----------
export interface InboxRow { tx: ReviewTxn; suggestion: Suggestion; refund: boolean; older: boolean }
export interface Inbox { week: string; rows: InboxRow[]; older: InboxRow[]; count: number }
export interface InboxOptions { importedAt?: Readonly<Record<string, string>> }

function eligible(t: ReviewTxn, state: ReviewState): boolean {
  if (t.category === "transfers" || t.category === "income") return false;
  if (t.categorisedBy === "user") return false;
  if (state.decisions[t.id]) return false;
  return t.amount < 0 || isRefund(t);
}

export function buildInbox(txns: readonly ReviewTxn[], state: ReviewState, now: Date, opts: InboxOptions = {}): Inbox {
  const today = localDate(now);
  const windowStart = addDays(today, -RULES.windowDays);
  const since = state.lastReviewedAt ? localDate(new Date(state.lastReviewedAt)) : addDays(today, -RULES.firstRunDays);
  const lastAt = state.lastReviewedAt ? Date.parse(state.lastReviewedAt) : -Infinity;
  const rows: InboxRow[] = [];
  const older: InboxRow[] = [];
  txns.forEach((t) => {
    if (!eligible(t, state) || t.date > today) return;
    const imported = opts.importedAt?.[t.id];
    const lateImport = imported !== undefined && Date.parse(imported) > lastAt;
    if (!(t.date >= since || lateImport)) return;
    const row: InboxRow = { tx: t, suggestion: suggest(t, state), refund: isRefund(t), older: t.date < windowStart };
    (row.older ? older : rows).push(row);
  });
  const skipRank = new Map(state.skipped.map((id, i) => [id, i]));
  const order = (a: InboxRow, b: InboxRow) => {
    const sa = skipRank.get(a.tx.id), sb = skipRank.get(b.tx.id);
    if (sa !== undefined || sb !== undefined) {
      if (sa === undefined) return -1;
      if (sb === undefined) return 1;
      return sa - sb;
    }
    return a.tx.date < b.tx.date ? 1 : a.tx.date > b.tx.date ? -1 : 0; // stable: same date keeps source order
  };
  rows.sort(order);
  older.sort(order);
  return { week: isoWeek(today), rows, older, count: rows.length };
}

export const countLabel = (n: number) => (n > 50 ? "50+" : String(n));

// ---------- reducer ----------
export type ReviewAction =
  | { type: "confirm"; tx: string; nwv?: Nwv }
  | { type: "change"; tx: string; category: Category; nwv: Nwv | null; rememberMerchant?: boolean }
  | { type: "skip"; tx: string }
  | { type: "confirmAll" }
  | { type: "rate"; tx: string; worth: Worth | null };

export interface ReviewCtx { txns: readonly ReviewTxn[]; now: Date; opts?: InboxOptions }
export interface ApplyResult { state: ReviewState; xpGained: number; cleared: boolean; streakBonus: number; message: string }

function award(state: ReviewState, week: string, amount: number): number {
  const used = state.weekXP[week] ?? 0;
  const gain = Math.max(0, Math.min(amount, RULES.xp.weeklyCap - used));
  state.weekXP = { ...state.weekXP, [week]: used + gain };
  state.xp += gain;
  return gain;
}

/** One entry point for every input path. Pure: returns a new state. */
export function applyAction(prev: ReviewState, action: ReviewAction, ctx: ReviewCtx): ApplyResult {
  const state: ReviewState = { ...prev, decisions: { ...prev.decisions }, merchantRules: { ...prev.merchantRules }, worth: { ...prev.worth }, skipped: [...prev.skipped], weekXP: { ...prev.weekXP }, clearedWeeks: [...prev.clearedWeeks] };
  const inbox = buildInbox(ctx.txns, prev, ctx.now, ctx.opts);
  const week = inbox.week;
  const at = isoLocal(ctx.now);
  const all = [...inbox.rows, ...inbox.older];
  const find = (id: string) => all.find((r) => r.tx.id === id);
  let xpGained = 0;
  let decided = 0;
  let message = "";

  const decide = (row: InboxRow, d: Omit<Decision, "at">, xp: number) => {
    state.decisions[row.tx.id] = { ...d, at, ...(state.worth[row.tx.id] ? { worth: state.worth[row.tx.id] } : {}) };
    state.skipped = state.skipped.filter((s) => s !== row.tx.id);
    if (!row.older) xpGained += award(state, week, xp); // Older imports can be confirmed but earn no XP
    decided += 1;
  };

  switch (action.type) {
    case "confirm": {
      const row = find(action.tx);
      if (!row) break;
      const nwv = row.refund ? null : action.nwv ?? row.suggestion.nwv;
      const changed = !row.refund && action.nwv !== undefined && action.nwv !== row.suggestion.nwv;
      decide(row, { category: row.suggestion.category, nwv, action: changed ? "change" : "confirm" }, changed ? RULES.xp.change : RULES.xp.confirm);
      message = `Confirmed ${row.tx.merchant ?? row.tx.description} as ${titleCat(row.suggestion.category)}${nwv ? `, ${NWV_META[nwv].label}` : ""}.`;
      break;
    }
    case "change": {
      const row = find(action.tx);
      if (!row) break;
      if (row.refund) { // refunds support Confirm only
        decide(row, { category: row.suggestion.category, nwv: null, action: "confirm" }, RULES.xp.confirm);
        break;
      }
      decide(row, { category: action.category, nwv: action.nwv, action: "change" }, RULES.xp.change);
      if (action.rememberMerchant) state.merchantRules[merchantKey(row.tx)] = { category: action.category, nwv: action.nwv };
      message = `Changed ${row.tx.merchant ?? row.tx.description} to ${titleCat(action.category)}${action.nwv ? `, ${NWV_META[action.nwv].label}` : ""}.`;
      break;
    }
    case "skip": {
      if (!find(action.tx)) break;
      state.skipped = [...state.skipped.filter((s) => s !== action.tx), action.tx];
      message = "Skipped for now.";
      break;
    }
    case "confirmAll": {
      // Re-read suggestions after each decision is unnecessary: merchant rules do not change here.
      for (const row of inbox.rows) decide(row, { category: row.suggestion.category, nwv: row.suggestion.nwv, action: "confirm" }, RULES.xp.confirm);
      message = `Confirmed ${inbox.rows.length} items.`;
      break;
    }
    case "rate": {
      // Worth-it ratings never touch XP.
      if (action.worth) state.worth[action.tx] = action.worth;
      else delete state.worth[action.tx];
      const d = state.decisions[action.tx];
      if (d) {
        const { worth: _drop, ...rest } = d;
        void _drop;
        state.decisions[action.tx] = action.worth ? { ...rest, worth: action.worth } : rest;
      }
      message = action.worth === "yes" ? "Marked worth it." : action.worth === "no" ? "Marked not really." : "Rating cleared.";
      break;
    }
  }

  let cleared = false;
  let streakBonus = 0;
  if (decided > 0) {
    const after = buildInbox(ctx.txns, state, ctx.now, ctx.opts);
    if (after.count === 0 && state.lastClearedWeek !== week) {
      cleared = true;
      const gap = state.lastClearedWeek ? weeksBetween(state.lastClearedWeek, week) : Infinity;
      if (gap === 1) state.streak += 1;
      else if (gap >= 2 && state.freezesLeft > 0) {
        state.freezesLeft -= 1; // one freeze covers exactly one missed week
        state.streak = gap === 2 ? state.streak + 1 : 1;
      } else state.streak = 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.clearsTowardFreeze += 1;
      if (state.clearsTowardFreeze >= RULES.refillEveryClears) { state.clearsTowardFreeze = 0; state.freezesLeft = Math.min(1, state.freezesLeft + 1); }
      state.lastClearedWeek = week;
      state.clearedWeeks = [...state.clearedWeeks.filter((w) => w !== week), week];
      state.lastReviewedAt = at;
      const bonusTarget = RULES.xp.streakBonusPer * Math.min(state.streak, RULES.xp.streakBonusMaxWeeks);
      const base = award(state, week, RULES.xp.weekCleared);
      streakBonus = award(state, week, bonusTarget);
      xpGained += base + streakBonus;
      message = `Inbox zero. Week ${weekNumber(week)} done ✨`;
    } else if (message && action.type !== "rate") {
      message += ` ${after.count} left.`;
    }
  }
  return { state, xpGained, cleared, streakBonus, message };
}

const titleCat = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

/** Streak copy: never red, never shaming. */
export function streakText(state: ReviewState, now: Date): string {
  if (!state.lastClearedWeek || state.streak === 0) return "Clear a week to start a streak";
  const gap = weeksBetween(state.lastClearedWeek, isoWeek(localDate(now)));
  if (gap > 2 || (gap === 2 && state.freezesLeft === 0)) return "Streak resting. Pick it up anytime 🌱";
  return `🔥 ${state.streak}-week streak`;
}

export function levelFor(xp: number): { current: Level; next: Level | null; progress: number } {
  let current = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXP) current = l;
  const next = LEVELS.find((l) => l.minXP > xp) ?? null;
  const progress = next ? (xp - current.minXP) / (next.minXP - current.minXP) : 1;
  return { current, next, progress };
}

// ---------- overlay ----------
/** Applies user decisions to transactions for display (category + categorisedBy: "user"). Never mutates input. */
export function overlayDecisions<T extends Transaction>(txns: readonly T[], state: ReviewState): T[] {
  if (!Object.keys(state.decisions).length) return txns as T[];
  return txns.map((t) => {
    const d = state.decisions[t.id];
    return d ? { ...t, category: d.category, categorisedBy: "user" as const, ...(d.nwv ? { nwv: d.nwv } : {}) } : t;
  });
}

// ---------- Worth it ----------
/** Effective Need/Want/Vice of a row: the user's decision wins, then the suggestion. */
export function effectiveNwv(t: ReviewTxn, state: ReviewState): Nwv | null {
  const d = state.decisions[t.id];
  if (d) return d.nwv;
  return suggest(t, state).nwv;
}

export interface WorthMonth { month: string; rated: number; yes: number; no: number; ratio: number | null }
export function monthlyRatio(txns: readonly ReviewTxn[], state: ReviewState, month: string): WorthMonth {
  let yes = 0, no = 0;
  for (const t of txns) {
    const w = state.worth[t.id];
    if (!w || !t.date.startsWith(month)) continue;
    const n = effectiveNwv(t, state);
    if (n !== "want" && n !== "vice") continue; // re-tagged as Need: rating kept, excluded from ratios
    if (w === "yes") yes += 1; else no += 1;
  }
  const rated = yes + no;
  return { month, rated, yes, no, ratio: rated < 5 ? null : Math.round((yes / rated) * 100) / 100 };
}

export function regretMerchants(txns: readonly ReviewTxn[], state: ReviewState, now: Date, windowDays = 60): string[] {
  const start = addDays(localDate(now), -windowDays);
  const by = new Map<string, { name: string; no: number; rated: number }>();
  for (const t of txns) {
    const w = state.worth[t.id];
    if (!w || t.date < start) continue;
    const n = effectiveNwv(t, state);
    if (n !== "want" && n !== "vice") continue;
    const k = merchantKey(t);
    const e = by.get(k) ?? { name: t.merchant ?? t.description, no: 0, rated: 0 };
    e.rated += 1;
    if (w === "no") e.no += 1;
    by.set(k, e);
  }
  return [...by.values()].filter((e) => e.no >= 3 && e.no / e.rated >= 0.6).sort((a, b) => b.no - a.no || a.name.localeCompare(b.name)).map((e) => e.name);
}

export type QuestSuggestion = { id: "no_delivery_week" | "qc_two_runs" | "wishlist_three" | "custom"; title: string; premium: boolean };
const DELIVERY = /deliver|biryani|pizza|food|eats|kitchen|bite/i;
const QUICK_COMMERCE = /instant|minute|quick ?mart|10 ?min|dash/i;
export function questFor(merchant: string, category: Category | undefined, premium: boolean): QuestSuggestion {
  if (category === "dining" && DELIVERY.test(merchant)) return { id: "no_delivery_week", title: "a No-Delivery Week", premium: false };
  if (QUICK_COMMERCE.test(merchant)) return { id: "qc_two_runs", title: "Two quick-commerce runs this week", premium: false };
  return premium ? { id: "custom", title: `a custom “skip ${merchant}” quest`, premium: true } : { id: "wishlist_three", title: "the Wishlist-three habit (wait 3 days before buying)", premium: false };
}

// ---------- undo ----------
export interface UndoEntry { prev: ReviewState; at: number; message: string }
export const canUndo = (u: UndoEntry | null, nowMs: number): u is UndoEntry => !!u && nowMs - u.at <= RULES.undoSeconds * 1000;
