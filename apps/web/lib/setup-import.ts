import { attribute, setupReducer, type SetupAction, type SetupState } from "@lakshly/shared";
import { emptyDataset, mergeResult, type ParseResult } from "@lakshly/parsers";
import type { ImportLog, UserData } from "./vault";
export function emptyUser(): UserData { return { version: 2, dataset: emptyDataset(), holdings: [], statements: [], imports: [], goals: [] }; }
export function attributionAction(user: UserData, entry: ImportLog, catalogId?: string): SetupAction {
  const dates: Record<string, string> = {};
  for (const id of entry.accountIds) {
    const values = [user.dataset.accounts.find(a => a.id === id)?.asOf,
      ...user.statements.filter(m => m.accountId === id).map(m => m.periodTo),
      ...user.dataset.transactions.filter(t => t.accountId === id).map(t => t.date)].filter((d): d is string => !!d);
    if (values.length) dates[id] = values.sort().at(-1)!;
  }
  return { type: "importAttributed", catalogId, adapter: entry.adapter, importId: entry.id,
    file: entry.file, confidence: entry.confidence, accountIds: entry.accountIds, added: entry.added, duplicates: entry.duplicates,
    accountDataDates: dates, dataset: { ...user.dataset, goals: user.goals }, platform: "web" };
}
export function reconcileImports(user: UserData, state: SetupState, now: string, today: string): SetupState {
  if (state.mode !== "mine") return state;
  let next = state;
  for (const entry of user.imports) {
    if (next.sources.some(s => s.importIds?.includes(entry.id))) continue;
    const remembered = next.sources.find(s => entry.accountIds.some(id => s.accountIds?.includes(id)))?.catalogId;
    const id = remembered ?? attribute(entry.adapter, next.sources).auto;
    if (id) {
      next = setupReducer(next, { ...attributionAction(user, entry, id), today, currentStep: next.currentStep }, now);
    }
  }
  return next;
}
export function mergeImport(base: UserData, result: ParseResult, file: string, now: string, importId: string) {
  const { dataset, report } = mergeResult(base.dataset, result);
  const ids = new Set(result.holdings.map(h => h.accountId));
  const entry: ImportLog = { id: importId, accountIds: result.accounts.map(a => a.id), at: now,
    file: file.slice(0, 120), confidence: result.confidence, adapter: result.adapter, added: report.added, duplicates: report.duplicates };
  const user: UserData = { ...base, dataset,
    holdings: [...base.holdings.filter(h => !ids.has(h.accountId)), ...result.holdings],
    statements: [...base.statements, ...result.meta], imports: [...base.imports, entry] };
  return { user, report, entry };
}
