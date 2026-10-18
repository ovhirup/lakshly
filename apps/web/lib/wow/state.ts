import { emptyBillState, normaliseBillState, type BillRadarState } from "@/lib/bills/radar";

// Encrypted wow preferences for My data or the synthetic demo. Bad fields fall back; normalise never throws.

export interface WowFee {
  id: string;
  name: string;
  /** Paise. */
  amount: number;
  /** Calendar day, yyyy-MM-dd. */
  due: string;
  yearly: boolean;
}

export interface WowState {
  bills: BillRadarState;
  /** What-if monthly extra, in paise. Clamped to 0...extraPaiseMax. */
  extraPaise: number;
  /** Cleared EMIs roll into the next debt. */
  rollOver: boolean;
  /** Subscription-audit ids, sorted and unique. */
  plannedCancels: string[];
  fees: WowFee[];
  setAside: Record<string, number>;
}

/** ₹1 crore, in paise. */
export const extraPaiseMax = 1_000_000_000;

const DUE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function emptyWow(): WowState {
  return { bills: emptyBillState(), extraPaise: 0, rollOver: false, plannedCancels: [], fees: [], setAside: {} };
}

/** Defensive decode: defaults, unique sorted cancels, bad fees dropped, amounts never negative. */
export function normaliseWow(raw: unknown): WowState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyWow();
  const r = raw as Partial<WowState>;
  return {
    bills: normaliseBillState(r.bills),
    extraPaise: clampExtra(r.extraPaise),
    rollOver: r.rollOver === true,
    plannedCancels: uniqueSorted(r.plannedCancels),
    fees: readFees(r.fees),
    setAside: readSetAside(r.setAside),
  };
}

function clampExtra(v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v)) return 0;
  if (v < 0) return 0;
  if (v > extraPaiseMax) return extraPaiseMax;
  return v;
}

function uniqueSorted(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) if (typeof item === "string") seen.add(item);
  return [...seen].sort();
}

function readFees(v: unknown): WowFee[] {
  if (!Array.isArray(v)) return [];
  const fees: WowFee[] = [];
  for (const item of v) {
    const fee = readFee(item);
    if (fee) fees.push(fee);
  }
  return fees;
}

function readFee(v: unknown): WowFee | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const f = v as Partial<WowFee>;
  if (typeof f.id !== "string" || f.id.length === 0) return null;
  if (typeof f.name !== "string") return null;
  if (typeof f.amount !== "number" || !Number.isSafeInteger(f.amount) || f.amount < 0) return null;
  if (typeof f.due !== "string" || !validDue(f.due)) return null;
  if (typeof f.yearly !== "boolean") return null;
  return { id: f.id, name: f.name, amount: f.amount, due: f.due, yearly: f.yearly };
}

function validDue(text: string): boolean {
  const match = DUE_RE.exec(text);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function readSetAside(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [slug, amount] of Object.entries(v as Record<string, unknown>)) {
    if (typeof amount === "number" && Number.isSafeInteger(amount)) out[slug] = Math.max(0, amount);
  }
  return out;
}
