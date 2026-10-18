// Subscription audit over statement rows. Amounts are paise. No React.
import type { Transaction } from "../schema.gen";
import type { WowState } from "./state";

export type SubscriptionCadence = "weekly" | "monthly" | "quarterly" | "yearly" | "irregular";

export type SubscriptionFlag =
  | { type: "priceUp"; pct: number }
  | { type: "doubleCharge"; month: string }
  | { type: "lapsed"; since: string }
  | { type: "overlap"; kind: string; count: number };

export interface SubscriptionItem {
  id: string;
  name: string;
  kind: string;
  charges: number;
  lastDate: string;
  lastPaise: number;
  typicalPaise: number;
  cadence: SubscriptionCadence;
  monthlyPaise: number;
  yearlyPaise: number;
  nextDate: string | null;
  flags: SubscriptionFlag[];
  lapsed: boolean;
  verdict: string;
}

export interface AuditResult {
  items: SubscriptionItem[];
  monthlyTotalPaise: number;
  yearlyTotalPaise: number;
  plannedSavingsYearlyPaise: number;
  yearlyAfterPlanPaise: number;
  overlaps: Record<string, string[]>;
}

interface Ymd {
  year: number;
  month: number;
  day: number;
}

const BLOCKED = new Set([
  "rent", "emi", "investments", "income", "transfers", "insurance", "utilities", "groceries", "fuel",
]);
const OVERLAP_KINDS = new Set(["video", "music", "cloud"]);
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const KIND_WORDS: readonly (readonly [string, readonly string[]])[] = [
  ["video", ["stream", "tv", "video", "flix", "prime", "play"]],
  ["music", ["tune", "music", "song", "radio"]],
  ["cloud", ["cloud", "drive", "storage", "backup"]],
  ["news", ["news", "times", "post", "mag"]],
];

export function flagText(flag: SubscriptionFlag): string {
  switch (flag.type) {
    case "priceUp": return `Price up ${flag.pct}%`;
    case "doubleCharge": return `Charged twice in ${flag.month}`;
    case "lapsed": return `No charge since ${flag.since}, may be cancelled already`;
    case "overlap": return `${flag.count} ${flag.kind} services`;
  }
}

/** Headline count: every listed item, with possibly-cancelled ones called out. Totals still skip lapsed items. */
export function auditCountLine(items: readonly Pick<SubscriptionItem, "lapsed">[]): string {
  const total = items.length;
  const lapsed = items.filter((item) => item.lapsed).length;
  const base = `${total} ${total === 1 ? "subscription" : "subscriptions"}`;
  return lapsed > 0 ? `${base} · ${lapsed} may be cancelled already` : base;
}

export function kindTitle(kind: string): string {
  switch (kind) {
    case "video": return "Video";
    case "music": return "Music";
    case "cloud": return "Cloud";
    case "news": return "News";
    default: return "Other";
  }
}

export function cadenceLabel(cadence: SubscriptionCadence): string {
  switch (cadence) {
    case "weekly": return "Weekly";
    case "monthly": return "Monthly";
    case "quarterly": return "Quarterly";
    case "yearly": return "Yearly";
    case "irregular": return "Irregular";
  }
}

export function scheduleLine(item: SubscriptionItem): string {
  if (!item.nextDate) return cadenceLabel(item.cadence);
  return `${cadenceLabel(item.cadence)} · next ${shortDay(item.nextDate)}`;
}

/** Add or remove one planned cancel. Ids stay sorted and unique. Does not mutate `state`. */
export function togglePlanned(state: WowState, id: string): WowState {
  const has = state.plannedCancels.includes(id);
  const plannedCancels = has
    ? state.plannedCancels.filter((item) => item !== id)
    : [...state.plannedCancels, id];
  return { ...state, plannedCancels: [...new Set(plannedCancels)].sort() };
}

export function buildAudit(txns: readonly Transaction[], now: Date, planned: ReadonlySet<string>): AuditResult {
  const groups = new Map<string, Transaction[]>();
  for (const txn of txns) {
    if (!isCandidate(txn)) continue;
    const slug = slugOf(txn);
    const list = groups.get(slug);
    if (list) list.push(txn);
    else groups.set(slug, [txn]);
  }

  const items: SubscriptionItem[] = [];
  for (const [slug, rows] of groups) {
    if (slug.length === 0) continue;
    const kept = rows.length >= 2 || rows.some((row) => row.category.toLowerCase() === "subscriptions");
    if (!kept) continue;
    const item = makeItem(slug, rows, now);
    if (item) items.push(item);
  }
  items.sort((a, b) => {
    if (a.yearlyPaise !== b.yearlyPaise) return a.yearlyPaise > b.yearlyPaise ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });

  const overlaps = overlapMap(items);
  const withFlags = items.map((item) => {
    const names = overlaps[item.kind];
    const flags = names && !item.lapsed
      ? [...item.flags, { type: "overlap" as const, kind: item.kind, count: names.length }]
      : item.flags;
    return {
      ...item,
      flags,
      lapsed: flags.some((flag) => flag.type === "lapsed"),
      verdict: verdictFor(flags),
    };
  });

  let monthlyTotalPaise = 0;
  let yearlyTotalPaise = 0;
  let plannedSavingsYearlyPaise = 0;
  for (const item of withFlags) {
    if (item.lapsed) continue;
    monthlyTotalPaise += item.monthlyPaise;
    yearlyTotalPaise += item.yearlyPaise;
    if (planned.has(item.id)) plannedSavingsYearlyPaise += item.yearlyPaise;
  }
  return {
    items: withFlags,
    monthlyTotalPaise,
    yearlyTotalPaise,
    plannedSavingsYearlyPaise,
    yearlyAfterPlanPaise: Math.max(0, yearlyTotalPaise - plannedSavingsYearlyPaise),
    overlaps,
  };
}

function isCandidate(txn: Transaction): boolean {
  if (txn.amount >= 0) return false;
  const category = txn.category.toLowerCase();
  if (category === "subscriptions" || category === "entertainment") return true;
  return txn.recurring === true && !BLOCKED.has(category);
}

function slugOf(txn: Transaction): string {
  return shownName(txn).toLowerCase();
}

function shownName(txn: Transaction): string {
  const merchant = txn.merchant?.trim() ?? "";
  if (merchant.length > 0) return merchant;
  return txn.description.trim();
}

function makeItem(slug: string, rows: readonly Transaction[], now: Date): SubscriptionItem | null {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const lastDay = parseDay(latest.date);
  if (!lastDay) return null;
  const amounts = sorted.map((row) => magnitude(row.amount));
  const typical = median(amounts);
  const gaps = gapDays(sorted);
  const category = latest.category.toLowerCase();
  const cadence = detectCadence(gaps.length === 0 ? null : medianGap(gaps), sorted.length, category);
  const span = gaps.reduce((sum, gap) => sum + gap, 0);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const monthlyPaise = normalisedMonthly(cadence, typical, total, span);
  const flags: SubscriptionFlag[] = [];
  if (amounts.length >= 2) {
    const earlier = median(amounts.slice(0, -1));
    const last = amounts[amounts.length - 1] ?? 0;
    if (earlier > 0 && last > earlier * 1.1) {
      const pct = Math.round(((last - earlier) / earlier) * 100);
      flags.push({ type: "priceUp", pct: Math.max(pct, 1) });
    }
  }
  if (cadence === "monthly") {
    const counts: Record<string, number> = {};
    for (const row of sorted) {
      const bucket = row.date.slice(0, 7);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    const doubled = Object.entries(counts).filter((pair) => pair[1] >= 2).map((pair) => pair[0]).sort();
    for (const bucket of doubled) flags.push({ type: "doubleCharge", month: longMonth(bucket) });
  }
  const length = lengthDays(cadence);
  if (length !== null) {
    const elapsed = daysBetween(lastDay, ymdFromDate(now));
    if (elapsed > length * 1.6) flags.push({ type: "lapsed", since: shortDay(latest.date) });
  }
  return {
    id: slug,
    name: shownName(latest),
    kind: kindOf(shownName(latest)),
    charges: sorted.length,
    lastDate: latest.date,
    lastPaise: amounts[amounts.length - 1] ?? 0,
    typicalPaise: typical,
    cadence,
    monthlyPaise,
    yearlyPaise: monthlyPaise * 12,
    nextDate: nextDay(lastDay, cadence),
    flags,
    lapsed: flags.some((flag) => flag.type === "lapsed"),
    verdict: verdictFor(flags),
  };
}

function kindOf(name: string): string {
  const hay = name.toLowerCase();
  for (const [kind, words] of KIND_WORDS) {
    if (words.some((word) => hay.includes(word))) return kind;
  }
  return "other";
}

function detectCadence(medianGapValue: number | null, count: number, category: string): SubscriptionCadence {
  if (medianGapValue !== null) {
    if (medianGapValue <= 10) return "weekly";
    if (medianGapValue <= 45) return "monthly";
    if (medianGapValue <= 120) return "quarterly";
    if (medianGapValue >= 300 && medianGapValue <= 400) return "yearly";
  }
  if (count === 1 && category === "subscriptions") return "monthly";
  return "irregular";
}

/** Weekly ×52/12, quarterly /3, yearly /12, from the typical charge. Irregular is the total over the day span in 30-day months. */
function normalisedMonthly(cadence: SubscriptionCadence, typical: number, total: number, spanDays: number): number {
  switch (cadence) {
    case "weekly": return Math.trunc((typical * 52) / 12);
    case "monthly": return typical;
    case "quarterly": return Math.trunc(typical / 3);
    case "yearly": return Math.trunc(typical / 12);
    case "irregular": return Math.trunc((total * 30) / Math.max(spanDays, 1));
  }
}

function verdictFor(flags: readonly SubscriptionFlag[]): string {
  if (flags.some((flag) => flag.type === "lapsed")) return "Looks cancelled";
  const worthALook = flags.some((flag) => flag.type === "priceUp" || flag.type === "doubleCharge" || flag.type === "overlap");
  return worthALook ? "Worth a look" : "Keep";
}

function overlapMap(items: readonly SubscriptionItem[]): Record<string, string[]> {
  const names: Record<string, string[]> = {};
  for (const item of items) {
    if (item.lapsed || !OVERLAP_KINDS.has(item.kind)) continue;
    const list = names[item.kind];
    if (list) list.push(item.name);
    else names[item.kind] = [item.name];
  }
  const overlaps: Record<string, string[]> = {};
  for (const [kind, list] of Object.entries(names)) {
    if (list.length >= 2) overlaps[kind] = list;
  }
  return overlaps;
}

function gapDays(rows: readonly Transaction[]): number[] {
  const days: Ymd[] = [];
  for (const row of rows) {
    const parsed = parseDay(row.date);
    if (parsed) days.push(parsed);
  }
  if (days.length < 2) return [];
  const gaps: number[] = [];
  for (let index = 1; index < days.length; index += 1) gaps.push(daysBetween(days[index - 1], days[index]));
  return gaps;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.trunc((sorted[mid - 1] + sorted[mid]) / 2);
}

function medianGap(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function magnitude(value: number): number {
  return value < 0 ? -value : value;
}

function lengthDays(cadence: SubscriptionCadence): number | null {
  switch (cadence) {
    case "weekly": return 7;
    case "monthly": return 30;
    case "quarterly": return 91;
    case "yearly": return 365;
    case "irregular": return null;
  }
}

function parseParts(ymd: string): Ymd | null {
  const bits = ymd.split("-");
  if (bits.length !== 3) return null;
  const year = Number(bits[0]);
  const month = Number(bits[1]);
  const day = Number(bits[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

function parseDay(ymd: string): Ymd | null {
  const parts = parseParts(ymd);
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) {
    return null;
  }
  return parts;
}

function ymdFromDate(now: Date): Ymd {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function daysBetween(from: Ymd, to: Ymd): number {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / 86400000);
}

function addDays(parts: Ymd, days: number): Ymd {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function addMonths(parts: Ymd, months: number): Ymd {
  const cursor = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(parts.day, lastDay) };
}

function formatYmd(parts: Ymd): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function nextDay(last: Ymd, cadence: SubscriptionCadence): string | null {
  switch (cadence) {
    case "weekly": return formatYmd(addDays(last, 7));
    case "monthly": return formatYmd(addMonths(last, 1));
    case "quarterly": return formatYmd(addMonths(last, 3));
    case "yearly": return formatYmd(addMonths(last, 12));
    case "irregular": return null;
  }
}

function shortDay(ymd: string): string {
  const parts = parseParts(ymd);
  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return ymd;
  return `${parts.day} ${SHORT_MONTHS[parts.month - 1]}`;
}

function longMonth(yyyyMM: string): string {
  const bits = yyyyMM.split("-").map(Number);
  if (bits.length !== 2 || !Number.isInteger(bits[1]) || bits[1] < 1 || bits[1] > 12) return yyyyMM;
  return LONG_MONTHS[bits[1] - 1];
}
