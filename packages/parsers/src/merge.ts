import type { LakshlyDataset, ParseResult } from "./types.ts";

export function emptyDataset(now = new Date()): LakshlyDataset {
  return { schemaVersion: "0.1.0", generatedAt: now.toISOString(), synthetic: false, currency: "INR", accounts: [], transactions: [], budgets: [], debts: [], sips: [], rewards: [] };
}

export interface MergeReport { added: number; duplicates: number; accountsAdded: number; accountsUpdated: number; sipsUpserted: number }

/**
 * Merge a parse result into a dataset. Idempotent: ids are content-derived, so re-importing the same
 * statement adds nothing. Accounts are updated when the incoming snapshot is as new or newer.
 */
export function mergeResult(base: LakshlyDataset, result: Pick<ParseResult, "accounts" | "transactions" | "sips">, now = new Date()): { dataset: LakshlyDataset; report: MergeReport } {
  const accounts = [...base.accounts];
  const report: MergeReport = { added: 0, duplicates: 0, accountsAdded: 0, accountsUpdated: 0, sipsUpserted: 0 };
  for (const a of result.accounts) {
    const i = accounts.findIndex((x) => x.id === a.id);
    if (i < 0) { accounts.push(a); report.accountsAdded++; }
    else if (a.asOf >= accounts[i].asOf) { accounts[i] = { ...accounts[i], ...a }; report.accountsUpdated++; }
  }
  const ids = new Set(base.transactions.map((t) => t.id));
  const transactions = [...base.transactions];
  for (const t of result.transactions) {
    if (ids.has(t.id)) { report.duplicates++; continue; }
    ids.add(t.id); transactions.push(t); report.added++;
  }
  transactions.sort((a, b) => a.date.localeCompare(b.date));
  const sips = [...(base.sips ?? [])];
  for (const s of result.sips) {
    const i = sips.findIndex((x) => x.id === s.id);
    if (i < 0) sips.push(s); else sips[i] = s;
    report.sipsUpserted++;
  }
  return { dataset: { ...base, generatedAt: now.toISOString(), synthetic: false, accounts, transactions, sips }, report };
}
