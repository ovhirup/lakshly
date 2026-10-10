import type { Account, LakshlyDataset, Transaction } from "./types.ts";

/**
 * Cross-format account matching and transaction de-duplication.
 * The same bank account can arrive as a CSV export (often no account number, sometimes no bank name)
 * and as a PDF statement (bank + last 4). Content ids differ between formats, so we match accounts
 * by bank + last 4, else by bank alone, else by overlapping transactions, and dedupe transactions by
 * date + amount + a format-tolerant description.
 */

const GENERIC_INSTITUTIONS = /^(bank|card|credit card|cards|account)$/i;
export const isGenericInstitution = (s: string | undefined) => !s || GENERIC_INSTITUTIONS.test(s.trim());

function family(t: Account["type"]): "bank" | "card" | null {
  if (t === "savings" || t === "current") return "bank";
  if (t === "credit_card") return "card";
  return null;
}

export function normInstitution(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/\b(bank|ltd|limited|of|india|the|co|corp(oration)?)\b/g, " ").replace(/[^a-z0-9]+/g, "");
}

/** Letters-only description words: survives masked/unmasked numbers, punctuation and case. */
function descWords(d: string): string[] {
  return d.toUpperCase().replace(/X{2,}\d*/g, " ").replace(/[^A-Z]+/g, " ").trim().split(" ").filter((w) => w.length > 1);
}

/** Same narration, tolerant of format differences (truncation, masking, punctuation, extra ref text). */
export function sameDescription(a: string, b: string): boolean {
  const x = descWords(a), y = descWords(b);
  if (!x.length || !y.length) return true; // date + amount already matched; nothing to compare
  const sx = x.join(" "), sy = y.join(" ");
  if (sx === sy) return true;
  const n = Math.min(sx.length, sy.length, 18);
  if (n >= 8 && sx.slice(0, n) === sy.slice(0, n)) return true;
  const A = new Set(x), B = new Set(y);
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.min(A.size, B.size) >= 0.6;
}

const bucketKey = (accountId: string, t: Pick<Transaction, "date" | "amount">) => `${accountId}|${t.date}|${t.amount}`;

/** Index of transactions by account + date + amount (a multiset: each base row can absorb one incoming row). */
export function txnIndex(txns: readonly Transaction[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const t of txns) {
    const k = bucketKey(t.accountId, t);
    const list = m.get(k) ?? [];
    list.push(t.description);
    m.set(k, list);
  }
  return m;
}

/** Consume a matching row from the index; true when the transaction is already there. */
export function takeDuplicate(index: Map<string, string[]>, t: Transaction): boolean {
  const list = index.get(bucketKey(t.accountId, t));
  if (!list?.length) return false;
  const i = list.findIndex((d) => sameDescription(d, t.description));
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}

function overlap(a: readonly Transaction[], b: readonly Transaction[], aId: string): number {
  const idx = txnIndex(b.map((t) => ({ ...t, accountId: aId })));
  let n = 0;
  for (const t of a) if (takeDuplicate(idx, { ...t, accountId: aId })) n++;
  return n;
}

function rangesOverlap(a: readonly Transaction[], b: readonly Transaction[]): boolean {
  if (!a.length || !b.length) return false;
  const span = (x: readonly Transaction[]) => x.reduce(([lo, hi], t) => [t.date < lo ? t.date : lo, t.date > hi ? t.date : hi], [x[0].date, x[0].date]);
  const [a0, a1] = span(a), [b0, b1] = span(b);
  return a0 <= b1 && b0 <= a1;
}

export type MatchReason = "mask" | "institution" | "overlap";
export interface AccountMatch { incomingId: string; baseId: string; reason: MatchReason; overlap: number }
export interface AmbiguousAccount { incomingId: string; candidateIds: string[] }

interface Candidate { id: string; reason: MatchReason; overlap: number; ratio: number }

function score(a: Account, aTx: readonly Transaction[], b: Account, bTx: readonly Transaction[]): Candidate | null {
  if (family(a.type) === null || family(a.type) !== family(b.type)) return null;
  const aGen = isGenericInstitution(a.institution), bGen = isGenericInstitution(b.institution);
  const sameInst = !aGen && !bGen && normInstitution(a.institution) === normInstitution(b.institution);
  if (!aGen && !bGen && !sameInst) return null; // two different named banks
  if (a.mask && b.mask && a.mask !== b.mask) return null; // two different account numbers
  const o = overlap(aTx, bTx, a.id);
  const ratio = o / Math.max(1, Math.min(aTx.length, bTx.length));
  if (sameInst && a.mask && b.mask) return { id: b.id, reason: "mask", overlap: o, ratio };
  if (sameInst) {
    // Same bank, one side without last 4: if both cover the same dates, their rows must agree too
    // (two different accounts at one bank share dates but not transactions).
    if (rangesOverlap(aTx, bTx) && ratio < 0.5) return null;
    return { id: b.id, reason: "institution", overlap: o, ratio };
  }
  // At least one side has no bank name: only transactions can tell.
  if (o >= 2 && ratio >= 0.5) return { id: b.id, reason: "overlap", overlap: o, ratio };
  return null;
}

/** Pick one candidate when the evidence is clear; otherwise report ambiguity and let the person decide. */
function decide(cands: Candidate[]): Candidate | "ambiguous" | null {
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];
  const masked = cands.filter((c) => c.reason === "mask");
  if (masked.length === 1) return masked[0];
  const sorted = [...cands].sort((x, y) => y.ratio - x.ratio || y.overlap - x.overlap);
  if (sorted[0].ratio >= 0.8 && sorted[1].ratio < 0.5) return sorted[0];
  return "ambiguous";
}

/** Match incoming accounts (not already present by id) to existing accounts of the same bank/card. */
export function matchAccounts(base: Pick<LakshlyDataset, "accounts" | "transactions">, incoming: { accounts: readonly Account[]; transactions: readonly Transaction[] }): { matches: AccountMatch[]; ambiguous: AmbiguousAccount[] } {
  const matches: AccountMatch[] = [];
  const ambiguous: AmbiguousAccount[] = [];
  const taken = new Set<string>();
  for (const a of incoming.accounts) {
    if (base.accounts.some((x) => x.id === a.id)) continue;
    const aTx = incoming.transactions.filter((t) => t.accountId === a.id);
    const cands = base.accounts
      .filter((b) => !taken.has(b.id) && !incoming.accounts.some((x) => x.id === b.id))
      .map((b) => score(a, aTx, b, base.transactions.filter((t) => t.accountId === b.id)))
      .filter((c): c is Candidate => !!c);
    const d = decide(cands);
    if (d === "ambiguous") ambiguous.push({ incomingId: a.id, candidateIds: cands.map((c) => c.id) });
    else if (d) { matches.push({ incomingId: a.id, baseId: d.id, reason: d.reason, overlap: d.overlap }); taken.add(d.id); }
  }
  return { matches, ambiguous };
}

/** Combine two records of one account: keep the named bank, last 4 and the newest balance. */
export function combineAccounts(keep: Account, other: Account): Account {
  const newer = other.asOf > keep.asOf ? other : keep;
  const named = (isGenericInstitution(keep.institution) && !isGenericInstitution(other.institution)) || (!keep.mask && !!other.mask && !isGenericInstitution(other.institution)) ? other : keep;
  const out: Account = { ...keep, ...Object.fromEntries(Object.entries(newer).filter(([, v]) => v !== undefined)), id: keep.id };
  out.institution = named.institution;
  out.name = named.name;
  const mask = keep.mask ?? other.mask;
  if (mask) out.mask = mask; else delete out.mask;
  for (const key of ["invested", "creditLimit", "statementDay", "dueDay", "source"] as const) {
    if (out[key] === undefined && (keep[key] ?? other[key]) !== undefined) Object.assign(out, { [key]: keep[key] ?? other[key] });
  }
  return out;
}

export interface DuplicateAccountPair { keepId: string; dropId: string; reason: MatchReason; overlap: number }

/** Accounts already saved twice (e.g. imported before cross-format matching existed). Offered as a merge. */
export function findDuplicateAccounts(ds: Pick<LakshlyDataset, "accounts" | "transactions">): DuplicateAccountPair[] {
  const out: DuplicateAccountPair[] = [];
  const used = new Set<string>();
  const tx = (id: string) => ds.transactions.filter((t) => t.accountId === id);
  for (let i = 0; i < ds.accounts.length; i++) {
    for (let j = i + 1; j < ds.accounts.length; j++) {
      const a = ds.accounts[i], b = ds.accounts[j];
      if (used.has(a.id) || used.has(b.id)) continue;
      const c = score(a, tx(a.id), b, tx(b.id));
      // Saved data needs real evidence: same bank + last 4, or overlapping transactions.
      if (!c || (c.reason === "institution" && c.overlap < 2)) continue;
      const keepB = isGenericInstitution(a.institution) && !isGenericInstitution(b.institution) || (!a.mask && !!b.mask);
      out.push({ keepId: keepB ? b.id : a.id, dropId: keepB ? a.id : b.id, reason: c.reason, overlap: c.overlap });
      used.add(a.id); used.add(b.id);
    }
  }
  return out;
}

/** Fold one account into another: remap its transactions/SIPs/debts/rewards, drop duplicate rows. */
export function mergeAccounts<D extends LakshlyDataset>(ds: D, dropId: string, keepId: string): { dataset: D; removed: number } {
  const keep = ds.accounts.find((a) => a.id === keepId), drop = ds.accounts.find((a) => a.id === dropId);
  if (!keep || !drop || keepId === dropId) return { dataset: ds, removed: 0 };
  const remap = <T extends { accountId?: string }>(v: T): T => (v.accountId === dropId ? { ...v, accountId: keepId } : v);
  const kept = ds.transactions.filter((t) => t.accountId !== dropId);
  const index = txnIndex(kept.filter((t) => t.accountId === keepId));
  let removed = 0;
  const moved: Transaction[] = [];
  for (const t of ds.transactions.filter((x) => x.accountId === dropId)) {
    const r = { ...t, accountId: keepId };
    if (takeDuplicate(index, r)) removed++; else moved.push(r);
  }
  const transactions = [...kept, ...moved].sort((a, b) => a.date.localeCompare(b.date));
  const accounts = ds.accounts.filter((a) => a.id !== dropId).map((a) => (a.id === keepId ? combineAccounts(keep, drop) : a));
  return {
    dataset: { ...ds, accounts, transactions, sips: (ds.sips ?? []).map(remap), ...(ds.debts ? { debts: ds.debts.map(remap) } : {}), ...(ds.rewards ? { rewards: ds.rewards.map(remap) } : {}) },
    removed,
  };
}

export interface Lookalike { incomingId: string; baseId: string; overlap: number }

/**
 * Rows that look identical to a *different* saved account (e.g. an SBI CSV whose rows equal the HDFC
 * account's). Never merged automatically: shown as a soft warning on the review screen.
 */
export function findLookalikes(base: Pick<LakshlyDataset, "accounts" | "transactions">, incoming: { accounts: readonly Account[]; transactions: readonly Transaction[] }, exclude: ReadonlySet<string> = new Set()): Lookalike[] {
  const out: Lookalike[] = [];
  for (const a of incoming.accounts) {
    if (exclude.has(a.id) || family(a.type) === null || base.accounts.some((x) => x.id === a.id)) continue;
    const aTx = incoming.transactions.filter((t) => t.accountId === a.id);
    if (aTx.length < 3) continue;
    for (const b of base.accounts) {
      if (family(b.type) !== family(a.type)) continue;
      const bTx = base.transactions.filter((t) => t.accountId === b.id);
      const o = overlap(aTx, bTx, a.id);
      if (o >= 3 && o / Math.min(aTx.length, bTx.length) >= 0.8) out.push({ incomingId: a.id, baseId: b.id, overlap: o });
    }
  }
  return out;
}
