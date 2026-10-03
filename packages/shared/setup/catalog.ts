import raw from './sources.catalog.json';
export interface Search { id: string; label: string; subjectAny: string[]; attachment: boolean; window: string }
export interface Source {
  id: string; name: string; aliases: string[]; region: string; kinds: string[]; accountTypes: string[];
  senders: { domains: string[]; addresses: string[]; excludeDomains: string[] };
  searches: Search[]; importer: { formats: string[]; adapters: string[]; supported: boolean; note?: string };
  passwordHints: string[]; cadence: { every: string; expectedDay?: number; graceDays: number };
  download: string | null; verified: string | null;
}
export const catalog = raw as typeof raw & { sources: Source[] };
export type SourceReference = string | { catalogId: string; custom?: { name: string; domain?: string } };
export function sourceFor(ref: SourceReference): Source {
  const id = typeof ref === 'string' ? ref : ref.catalogId;
  const known = catalog.sources.find(s => s.id === id);
  if (known) return known;
  const custom = typeof ref === 'string' ? undefined : ref.custom;
  return { id, name: custom?.name ?? id, aliases: [], region: 'IN', kinds: ['bank'], accountTypes: [],
    senders: { domains: custom?.domain ? [custom.domain] : [], addresses: [], excludeDomains: [] },
    searches: custom?.domain ? [{ id: 'statements', label: 'Statements', subjectAny: ['statement'], attachment: true, window: '2y' }] : [],
    importer: { formats: ['pdf', 'csv'], adapters: ['bank.generic', 'card.generic'], supported: true },
    passwordHints: [], cadence: { every: 'month', graceDays: 10 }, download: null, verified: null };
}
