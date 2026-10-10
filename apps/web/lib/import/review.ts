// What a reviewed statement will add, and the line shown after it is saved.
import type { MergeReport, ParseResult } from "@lakshly/parsers";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Counts what will be saved: included transactions, plus holdings and SIPs from a CAS. */
export function importCounts(result: Pick<ParseResult, "transactions" | "holdings" | "sips">, skip: Record<string, boolean> = {}) {
  return {
    transactions: result.transactions.filter((t) => !skip[t.id]).length,
    holdings: result.holdings?.length ?? 0,
    sips: result.sips?.length ?? 0,
  };
}

/** "Confirm import (12 transactions, 3 holdings)". No count when nothing is countable. */
export function confirmImportLabel(counts: ReturnType<typeof importCounts>): string {
  const parts = [
    counts.transactions ? plural(counts.transactions, "transaction") : "",
    counts.holdings ? plural(counts.holdings, "holding") : "",
    counts.sips ? plural(counts.sips, "SIP") : "",
  ].filter(Boolean);
  return parts.length ? `Confirm import (${parts.join(", ")})` : "Confirm import";
}

/** Saved-import toast. A CAS often has accounts and no transactions, so it must not say "0 new transactions". */
export function importToast(report: MergeReport): string {
  const saved = [
    report.added ? plural(report.added, "new transaction") : "",
    report.accountsAdded ? plural(report.accountsAdded, "account") : "",
    report.sipsUpserted ? plural(report.sipsUpserted, "SIP") : "",
  ].filter(Boolean);
  const skipped = report.duplicates ? `skipped ${report.duplicates} already imported` : "";
  const lead = saved.length
    ? `Imported ${saved.join(", ")}`
    : report.accountsUpdated
      ? `Updated ${plural(report.accountsUpdated, "account")}`
      : "Nothing new to import";
  return `${lead}${skipped ? `, ${skipped}` : ""}. Thank you for trusting Lakshly 💛`;
}

/** Shown after a statement password is rejected. Points at the bank pattern when one is listed. */
export function wrongPasswordMessage(hasPattern: boolean): string {
  return hasPattern
    ? "That password didn't work. Use one of the patterns listed above."
    : "That password didn't work. Try again.";
}
