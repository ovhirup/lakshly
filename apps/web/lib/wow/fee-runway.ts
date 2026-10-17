// Yearly-fee runway. Amounts are paise. No React.
import { formatINR } from "../format";
import type { Transaction } from "../schema.gen";
import type { WowFee, WowState } from "./state";

export type RunwayStatus = "funded" | "onTrack" | "behind";

export interface RunwayFee {
  id: string;
  name: string;
  amount: number;
  due: string;
  yearly: boolean;
  monthsLeft: number;
  daysLeft: number;
  toGoPaise: number;
  perMonthPaise: number;
  fraction: number;
  status: RunwayStatus;
  setAside: number;
}

export interface RunwayPlan {
  fees: RunwayFee[];
  monthlyNeedPaise: number;
  totalPaise: number;
  fundedPaise: number;
  fundedFraction: number;
}

export interface FeeLogResult {
  setAside: Record<string, number>;
  fundedNow: boolean;
  changed: boolean;
}

interface Ymd {
  year: number;
  month: number;
  day: number;
}

interface FeeBand {
  name: string;
  dates: string[];
  lastDate: string;
  lastAmount: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HINTS = ["annual fee", "renewal", "membership", "licence", "license", "premium"];

/** A pot never stores more than this many paise. */
export const potMax = 1_000_000_000_000;

export function runwayPlan(
  fees: readonly WowFee[],
  setAside: Readonly<Record<string, number>>,
  now: Date,
): RunwayPlan {
  const today = ymdFromDate(now);
  const ready = prepared(fees, setAside, today);
  const rows = ready.fees
    .map((fee) => row(fee, Math.max(0, ready.setAside[fee.id] ?? 0), today))
    .sort((a, b) => compareText(a.due, b.due) || compareText(a.name, b.name) || compareText(a.id, b.id));
  let monthly = 0;
  let total = 0;
  let funded = 0;
  for (const item of rows) {
    monthly += item.perMonthPaise;
    total += Math.max(0, item.amount);
    funded += Math.min(Math.max(0, item.setAside), Math.max(0, item.amount));
  }
  return {
    fees: rows,
    monthlyNeedPaise: monthly,
    totalPaise: total,
    fundedPaise: funded,
    fundedFraction: total > 0 ? funded / total : 0,
  };
}

/**
 * Adds `paise` into the pot. Ignores values below 1. The pot stays inside 0...1e12.
 * `fundedNow` is true only on the add that first reaches the fee amount.
 */
export function logFee(
  fees: readonly WowFee[],
  setAside: Readonly<Record<string, number>>,
  id: string,
  paise: number,
): FeeLogResult {
  const fee = fees.find((item) => item.id === id);
  if (!(paise > 0) || !Number.isSafeInteger(paise) || !fee) {
    return { setAside: { ...setAside }, fundedNow: false, changed: false };
  }
  const before = clampPot(setAside[id] ?? 0);
  const next = before + Math.min(paise, potMax - before);
  const fundedNow = before < fee.amount && next >= fee.amount;
  const changed = next !== (setAside[id] ?? 0);
  if (!changed) return { setAside: { ...setAside }, fundedNow, changed };
  return { setAside: { ...setAside, [id]: next }, fundedNow, changed };
}

export function resetFee(setAside: Readonly<Record<string, number>>, id: string): Record<string, number> {
  return { ...setAside, [id]: 0 };
}

/** Detected fees. They stay suggestions until the caller adds them. */
export function feeSuggestions(
  txns: readonly Transaction[],
  existing: readonly WowFee[],
  now: Date,
): WowFee[] {
  const today = ymdFromDate(now);
  const takenIds = new Set(existing.map((fee) => fee.id));
  const takenSlugs = new Set(existing.map((fee) => slug(fee.name)));
  const bands = new Map<string, FeeBand>();
  for (const txn of txns) {
    if (!isFeeSpend(txn)) continue;
    const name = display(txn);
    const group = slug(name);
    if (group.length === 0) continue;
    const band = bands.get(group) ?? { name, dates: [], lastDate: "", lastAmount: 0 };
    band.dates.push(txn.date);
    if (band.lastDate.length === 0 || txn.date >= band.lastDate) {
      band.lastDate = txn.date;
      band.lastAmount = magnitude(txn.amount);
      band.name = name;
    }
    bands.set(group, band);
  }
  const found: WowFee[] = [];
  for (const [group, band] of bands) {
    const id = `sugg-${group}`;
    if (takenIds.has(id) || takenSlugs.has(group)) continue;
    if (!qualifies(band, today)) continue;
    const due = addYears(band.lastDate, 1);
    if (!due) continue;
    found.push({ id, name: band.name, amount: band.lastAmount, due, yearly: true });
  }
  found.sort((a, b) => compareText(a.due, b.due) || compareText(a.id, b.id));
  return found;
}

/** Three synthetic yearly fees placed against `now`. Paise, demo names only. */
export function demoFeeSeed(now: Date): { fees: WowFee[]; setAside: Record<string, number> } {
  const today = ymdFromDate(now);
  const rows: readonly { id: string; name: string; rupees: number; months: number; savedRupees: number }[] = [
    { id: "demo-car-insurance", name: "Demo Car Insurance", rupees: 14_500, months: 4, savedRupees: 9_000 },
    { id: "sample-card-annual-fee", name: "Sample Card Co annual fee", rupees: 2_999, months: 7, savedRupees: 0 },
    { id: "example-professional-licence", name: "Example Professional Licence", rupees: 9_000, months: 11, savedRupees: 2_000 },
  ];
  const fees: WowFee[] = [];
  const setAside: Record<string, number> = {};
  for (const item of rows) {
    fees.push({
      id: item.id,
      name: item.name,
      amount: item.rupees * 100,
      due: formatYmd(addMonths(today, item.months)),
      yearly: true,
    });
    setAside[item.id] = item.savedRupees * 100;
  }
  return { fees, setAside };
}

/** Active-record log. `fundedNow` is false when nothing was saved. */
export function applyFeeLog(state: WowState, id: string, paise: number): { state: WowState; fundedNow: boolean } {
  if (!(paise > 0) || !Number.isSafeInteger(paise)) return { state, fundedNow: false };
  const outcome = logFee(state.fees, state.setAside, id, paise);
  if (!outcome.changed) return { state, fundedNow: false };
  return { state: { ...state, setAside: outcome.setAside }, fundedNow: outcome.fundedNow };
}

export function applyFeeReset(state: WowState, id: string): WowState {
  return { ...state, setAside: resetFee(state.setAside, id) };
}

export function applyFeeAdd(state: WowState, fee: WowFee): WowState {
  return { ...state, fees: [...state.fees.filter((item) => item.id !== fee.id), fee] };
}

/** Drops the fee and its pot. */
export function applyFeeRemove(state: WowState, id: string): WowState {
  const setAside = { ...state.setAside };
  delete setAside[id];
  return { ...state, fees: state.fees.filter((item) => item.id !== id), setAside };
}

export function headline(monthlyNeedPaise: number): string {
  return `Set aside ${money(monthlyNeedPaise)} a month`;
}

export function readyLine(fundedPaise: number, totalPaise: number, fraction: number): string {
  return `${money(fundedPaise)} of ${money(totalPaise)} ready (${percent(fraction)}%)`;
}

export function perMonthLine(paise: number): string {
  return `${money(paise)} a month`;
}

export function dueLine(due: string, daysLeft: number): string {
  const span = daysLeft <= 0 ? "today" : daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  return `due ${dueDateLabel(due)} · ${span}`;
}

export function dueDateLabel(due: string): string {
  const bits = due.split("-");
  if (bits.length < 3) return due;
  const month = Number(bits[1]);
  const day = Number(bits[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return due;
  if (month < 1 || month > 12 || day < 1 || day > 31) return due;
  return `${day} ${MONTHS[month - 1]}`;
}

export function statusTitle(status: RunwayStatus): string {
  switch (status) {
    case "funded": return "Funded ✓";
    case "onTrack": return "On track";
    case "behind": return "Behind";
  }
}

export function percent(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.round(clamped * 100);
}

/** Whole rupees when the paisa tail is 0, otherwise two decimal places. Empty when there is nothing to log. */
export function rupeeField(paise: number): string {
  if (!(paise > 0) || !Number.isSafeInteger(paise)) return "";
  const whole = Math.trunc(paise / 100);
  const fraction = paise % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** Rupee text ("1,500", "₹3.50") to paise. Null when empty, zero, or not a simple amount. */
export function paiseFromRupees(raw: string): number | null {
  let text = raw.trim();
  if (text.startsWith("₹")) text = text.slice(1);
  text = text.replaceAll(",", "").replaceAll(" ", "");
  if (text.startsWith("₹")) text = text.slice(1);
  if (text.length === 0 || text.startsWith("-")) return null;
  const parts = text.split(".");
  if (parts.length > 2) return null;
  const whole = parts[0].length === 0 ? "0" : parts[0];
  if (!/^[0-9]+$/.test(whole)) return null;
  const rupees = Number(whole);
  if (!Number.isSafeInteger(rupees)) return null;
  let fraction = 0;
  if (parts.length === 2) {
    const tail = parts[1];
    if (tail.length > 2 || !/^[0-9]*$/.test(tail)) return null;
    if (tail.length === 1) fraction = Number(tail) * 10;
    else if (tail.length === 2) fraction = Number(tail);
  }
  const sum = rupees * 100 + fraction;
  if (!Number.isSafeInteger(sum) || sum <= 0) return null;
  return sum;
}

/** Calendar day of `date` in the local timezone, yyyy-MM-dd. */
export function dayString(date: Date): string {
  return formatYmd(ymdFromDate(date));
}

function money(paise: number): string {
  return formatINR(paise, paise % 100 !== 0 ? { decimals: true } : {});
}

function prepared(
  fees: readonly WowFee[],
  setAside: Readonly<Record<string, number>>,
  today: Ymd,
): { fees: WowFee[]; setAside: Record<string, number> } {
  const pots: Record<string, number> = { ...setAside };
  const kept: WowFee[] = [];
  for (const fee of fees) {
    let dueDate = parseDay(fee.due);
    if (!dueDate) continue;
    const copy: WowFee = { ...fee };
    let drop = false;
    let hops = 0;
    while (compareYmd(dueDate, today) < 0) {
      if (!copy.yearly) {
        drop = true;
        break;
      }
      hops += 1;
      if (hops > 30) {
        drop = true;
        break;
      }
      const next = addMonths(dueDate, 12);
      if (compareYmd(next, dueDate) === 0) {
        drop = true;
        break;
      }
      dueDate = next;
      const pot = pots[copy.id] ?? 0;
      pots[copy.id] = pot > copy.amount ? pot - copy.amount : 0;
    }
    if (drop) {
      delete pots[copy.id];
      continue;
    }
    copy.due = formatYmd(dueDate);
    kept.push(copy);
  }
  return { fees: kept, setAside: pots };
}

function row(fee: WowFee, pot: number, today: Ymd): RunwayFee {
  const dueDate = parseDay(fee.due) ?? today;
  const monthsLeft = Math.max(1, monthsBetween(today, dueDate));
  const daysLeft = Math.max(0, daysBetween(today, dueDate));
  const amount = Math.max(0, fee.amount);
  const toGo = Math.max(0, amount - pot);
  const fraction = amount > 0 ? Math.min(1, pot / amount) : 1;
  const expected = expectedPaise(amount, dueDate, fee.yearly, today);
  const status: RunwayStatus = pot >= amount ? "funded" : pot >= expected ? "onTrack" : "behind";
  return {
    id: fee.id,
    name: fee.name,
    amount: fee.amount,
    due: fee.due,
    yearly: fee.yearly,
    monthsLeft,
    daysLeft,
    toGoPaise: toGo,
    perMonthPaise: ceilDivide(toGo, monthsLeft),
    fraction,
    status,
    setAside: pot,
  };
}

/** For a yearly fee, the share of the 12 months before due that has already elapsed. Otherwise 0. */
function expectedPaise(amount: number, due: Ymd, yearly: boolean, today: Ymd): number {
  if (!yearly || amount <= 0) return 0;
  const start = addMonths(due, -12);
  const total = daysBetween(start, due);
  if (total <= 0) return 0;
  const elapsed = daysBetween(start, today);
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return amount;
  return Math.trunc((amount * elapsed) / total);
}

function qualifies(band: FeeBand, today: Ymd): boolean {
  const unique = [...new Set(band.dates.filter((text) => parseDay(text) !== null))].sort();
  const last = unique[unique.length - 1];
  if (!last) return false;
  if (unique.length >= 2) {
    const previous = unique[unique.length - 2];
    const gap = daysBetween(parseDay(previous) as Ymd, parseDay(last) as Ymd);
    return gap >= 300 && gap <= 400;
  }
  const charge = parseDay(last);
  if (!charge) return false;
  return compareYmd(charge, addMonths(today, -9)) < 0;
}

function isFeeSpend(txn: Transaction): boolean {
  if (!(txn.amount < 0)) return false;
  if (txn.category.trim().toLowerCase() === "insurance") return true;
  const blob = `${txn.merchant ?? ""} ${txn.description}`.toLowerCase();
  return HINTS.some((hint) => blob.includes(hint));
}

function display(txn: Transaction): string {
  const merchant = txn.merchant?.trim() ?? "";
  if (merchant.length > 0) return merchant;
  return txn.description.trim();
}

function slug(raw: string): string {
  let out = "";
  let dash = false;
  for (const ch of raw.toLowerCase()) {
    if (/^[\p{L}\p{N}]$/u.test(ch)) {
      out += ch;
      dash = false;
    } else if (!dash && out.length > 0) {
      out += "-";
      dash = true;
    }
  }
  while (out.endsWith("-")) out = out.slice(0, -1);
  return out;
}

function ceilDivide(numerator: number, denominator: number): number {
  if (numerator <= 0) return 0;
  const span = Math.max(denominator, 1);
  return Math.trunc((numerator - 1) / span) + 1;
}

function clampPot(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), potMax);
}

function magnitude(value: number): number {
  return value < 0 ? -value : value;
}

function addYears(ymd: string, years: number): string | null {
  const due = parseDay(ymd);
  if (!due) return null;
  return formatYmd(addMonths(due, years * 12));
}

function parseDay(ymd: string): Ymd | null {
  const bits = ymd.split("-");
  if (bits.length < 3) return null;
  const year = Number(bits[0]);
  const month = Number(bits[1]);
  const day = Number(bits[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function ymdFromDate(now: Date): Ymd {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function daysBetween(from: Ymd, to: Ymd): number {
  const start = Date.UTC(from.year, from.month - 1, from.day);
  const end = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((end - start) / 86400000);
}

function monthsBetween(from: Ymd, to: Ymd): number {
  let months = (to.year - from.year) * 12 + (to.month - from.month);
  if (to.day < from.day) months -= 1;
  return months;
}

function addMonths(parts: Ymd, months: number): Ymd {
  const cursor = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(parts.day, lastDay) };
}

function compareYmd(a: Ymd, b: Ymd): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function formatYmd(parts: Ymd): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
