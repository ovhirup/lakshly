import type { Holding, LakshlyDataset, ParseResult } from "@lakshly/parsers";
import type { UserData } from "@/lib/vault";

/** Merge security snapshots separately from the dataset's account balances. */
export function mergeImportDetails(base: Pick<UserData, "holdings" | "statements">, result: ParseResult, dataset: LakshlyDataset, aliases: Record<string, string>) {
  const remap = (id: string) => aliases[id] ?? id;
  const groups = new Map<string, { original: string; date: string; holdings: Holding[] }>();
  const originals = new Map<string, Holding[]>();
  for (const holding of base.holdings) {
    const group = originals.get(holding.accountId) ?? [];
    group.push(holding);
    originals.set(holding.accountId, group);
  }
  for (const [original, holdings] of originals) {
    const id = remap(original);
    const date = holdings.reduce((latest, h) => h.navDate > latest ? h.navDate : latest, "");
    const retained = groups.get(id);
    if (!retained || date > retained.date || date === retained.date && original === id && retained.original !== id) {
      groups.set(id, { original, date, holdings: holdings.map((h) => ({ ...h, accountId: id })) });
    }
  }
  const incoming = new Map<string, Holding[]>();
  for (const holding of result.holdings) {
    const id = remap(holding.accountId);
    const group = incoming.get(id) ?? [];
    group.push({ ...holding, accountId: id });
    incoming.set(id, group);
  }
  for (const [id, holdings] of incoming) {
    const date = holdings.reduce((latest, h) => h.navDate > latest ? h.navDate : latest, "");
    const retained = groups.get(id);
    const incomingAccount = result.accounts.find((a) => remap(a.id) === id);
    const savedAccount = dataset.accounts.find((a) => a.id === id);
    if ((!retained || date >= retained.date) && incomingAccount?.asOf === savedAccount?.asOf) groups.set(id, { original: id, date, holdings });
  }
  return {
    holdings: [...groups.values()].flatMap((group) => group.holdings),
    statements: [...base.statements, ...result.meta].map((meta) => ({ ...meta, accountId: remap(meta.accountId) })),
  };
}
