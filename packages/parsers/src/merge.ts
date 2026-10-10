import type { Account, LakshlyDataset, ParseResult } from "./types.ts";
import { combineAccounts, matchAccounts, takeDuplicate, txnIndex, type AccountMatch, type AmbiguousAccount } from "./match.ts";

export function emptyDataset(now = new Date()): LakshlyDataset {
  return { schemaVersion: "0.1.0", generatedAt: now.toISOString(), synthetic: false, currency: "INR", accounts: [], transactions: [], budgets: [], debts: [], sips: [], rewards: [] };
}

export interface MergeReport {
  added: number; duplicates: number; accountsAdded: number; accountsUpdated: number; sipsUpserted: number;
  /** Incoming accounts folded into an existing one (e.g. a CSV and a PDF of the same bank account). */
  matched?: AccountMatch[];
  /** Incoming accounts that look like more than one existing account: saved separately, offer a merge. */
  ambiguous?: AmbiguousAccount[];
}

/**
 * Merge a parse result into a dataset. Idempotent: ids are content-derived, so re-importing the same
 * statement adds nothing. Accounts are updated when the incoming snapshot is as new or newer.
 */
export function mergeResult(base: LakshlyDataset, input: Pick<ParseResult, "accounts" | "transactions" | "sips" | "accountAliases">, now = new Date()): { dataset: LakshlyDataset; report: MergeReport; accountAliases: Record<string, string> } {
  let result = input;
  const proposed = result.accountAliases ?? {};
  const accountAliases: Record<string, string> = {};
  for (const [source, target] of Object.entries(proposed)) {
    if (source === target || Object.hasOwn(proposed, target) || Object.values(proposed).includes(source)) continue;
    if (!result.accounts.some((a) => a.id === target && a.type === "mutual_fund")) continue;
    if (base.accounts.some((a) => a.id === source && a.type !== "mutual_fund")) continue;
    accountAliases[source] = target;
  }
  // Cross-format: the same bank account as CSV and PDF has different content ids. Fold it into the saved one.
  const { matches, ambiguous } = matchAccounts(base, { accounts: result.accounts.filter((a) => !accountAliases[a.id]), transactions: result.transactions });
  const cross: Record<string, string> = Object.fromEntries(matches.map((m) => [m.incomingId, m.baseId]));
  const remapIn = (id: string) => cross[id] ?? id;
  result = {
    ...result,
    accounts: result.accounts.map((a) => {
      const target = cross[a.id];
      if (!target) return a;
      const saved = base.accounts.find((x) => x.id === target)!;
      return combineAccounts({ ...saved, asOf: a.asOf > saved.asOf ? a.asOf : saved.asOf, balance: a.asOf >= saved.asOf ? a.balance : saved.balance }, { ...a, id: target });
    }),
    transactions: result.transactions.map((t) => (cross[t.accountId] ? { ...t, accountId: remapIn(t.accountId) } : t)),
    sips: result.sips.map((s) => (s.accountId && cross[s.accountId] ? { ...s, accountId: remapIn(s.accountId) } : s)),
  };
  Object.assign(accountAliases, cross);
  const remap = <T extends { accountId?: string }>(value: T): T => value.accountId && accountAliases[value.accountId] ? { ...value, accountId: accountAliases[value.accountId] } : { ...value };
  const accounts: Account[] = [];
  const originalCanonical = new Set<string>();
  for (const original of base.accounts) {
    const id = accountAliases[original.id] ?? original.id;
    const account = { ...original, id };
    const i = accounts.findIndex((a) => a.id === id);
    if (i < 0) accounts.push(account);
    else {
      const old = accounts[i];
      const incomingWins = account.asOf > old.asOf || account.asOf === old.asOf && original.id === id && !originalCanonical.has(id);
      const winner = incomingWins ? account : old, loser = incomingWins ? old : account;
      accounts[i] = { ...loser, ...winner };
      for (const key of ["invested", "mask", "creditLimit", "statementDay", "dueDay", "source"] as const) {
        if (winner[key] === undefined && loser[key] !== undefined) Object.assign(accounts[i], { [key]: loser[key] });
      }
    }
    if (original.id === id) originalCanonical.add(id);
  }
  const report: MergeReport = { added: 0, duplicates: 0, accountsAdded: 0, accountsUpdated: 0, sipsUpserted: 0, ...(matches.length ? { matched: matches } : {}), ...(ambiguous.length ? { ambiguous } : {}) };
  for (const a of result.accounts) {
    const i = accounts.findIndex((x) => x.id === a.id);
    if (i < 0) { accounts.push(a); report.accountsAdded++; }
    else if (a.asOf >= accounts[i].asOf) { accounts[i] = { ...accounts[i], ...Object.fromEntries(Object.entries(a).filter(([, value]) => value !== undefined)) }; report.accountsUpdated++; }
  }
  const ids = new Set(base.transactions.map((t) => t.id));
  const transactions = base.transactions.map(remap);
  // Format-tolerant dedupe for bank and card rows (CSV vs PDF of one statement). Fund rows keep exact ids.
  const bankish = new Set(accounts.filter((a) => a.type === "savings" || a.type === "current" || a.type === "credit_card").map((a) => a.id));
  const index = txnIndex(transactions.filter((t) => bankish.has(t.accountId)));
  for (const t of result.transactions) {
    if (ids.has(t.id)) { takeDuplicate(index, remap(t)); report.duplicates++; continue; }
    if (bankish.has(remap(t).accountId) && takeDuplicate(index, remap(t))) { report.duplicates++; continue; }
    ids.add(t.id); transactions.push(remap(t)); report.added++;
  }
  transactions.sort((a, b) => a.date.localeCompare(b.date));
  const sips = (base.sips ?? []).map(remap);
  for (const s of result.sips) {
    const i = sips.findIndex((x) => x.id === s.id);
    if (i < 0) sips.push(remap(s)); else sips[i] = remap(s);
    report.sipsUpserted++;
  }
  return { dataset: { ...base, generatedAt: now.toISOString(), synthetic: false, accounts, transactions, sips, ...(base.debts ? { debts: base.debts.map(remap) } : {}), ...(base.rewards ? { rewards: base.rewards.map(remap) } : {}) }, report, accountAliases };
}
