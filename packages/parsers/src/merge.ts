import type { Account, LakshlyDataset, ParseResult } from "./types.ts";

export function emptyDataset(now = new Date()): LakshlyDataset {
  return { schemaVersion: "0.1.0", generatedAt: now.toISOString(), synthetic: false, currency: "INR", accounts: [], transactions: [], budgets: [], debts: [], sips: [], rewards: [] };
}

export interface MergeReport { added: number; duplicates: number; accountsAdded: number; accountsUpdated: number; sipsUpserted: number }

/**
 * Merge a parse result into a dataset. Idempotent: ids are content-derived, so re-importing the same
 * statement adds nothing. Accounts are updated when the incoming snapshot is as new or newer.
 */
export function mergeResult(base: LakshlyDataset, result: Pick<ParseResult, "accounts" | "transactions" | "sips" | "accountAliases">, now = new Date()): { dataset: LakshlyDataset; report: MergeReport; accountAliases: Record<string, string> } {
  const proposed = result.accountAliases ?? {};
  const accountAliases: Record<string, string> = {};
  for (const [source, target] of Object.entries(proposed)) {
    if (source === target || Object.hasOwn(proposed, target) || Object.values(proposed).includes(source)) continue;
    if (!result.accounts.some((a) => a.id === target && a.type === "mutual_fund")) continue;
    if (base.accounts.some((a) => a.id === source && a.type !== "mutual_fund")) continue;
    accountAliases[source] = target;
  }
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
  const report: MergeReport = { added: 0, duplicates: 0, accountsAdded: 0, accountsUpdated: 0, sipsUpserted: 0 };
  for (const a of result.accounts) {
    const i = accounts.findIndex((x) => x.id === a.id);
    if (i < 0) { accounts.push(a); report.accountsAdded++; }
    else if (a.asOf >= accounts[i].asOf) { accounts[i] = { ...accounts[i], ...Object.fromEntries(Object.entries(a).filter(([, value]) => value !== undefined)) }; report.accountsUpdated++; }
  }
  const ids = new Set(base.transactions.map((t) => t.id));
  const transactions = base.transactions.map(remap);
  for (const t of result.transactions) {
    if (ids.has(t.id)) { report.duplicates++; continue; }
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
