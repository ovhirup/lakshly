// What a reviewed statement will add, for the importer's confirm button.
import type { ParseResult } from "@lakshly/parsers";

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
