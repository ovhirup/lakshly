// Types for the setup wizard sources catalog (packages/shared/setup/sources.json).
export type SourceKind = "bank" | "card" | "paylater" | "cas" | "invest" | "insurance" | "subscription" | "score";

export interface SourceSearch {
  id: string;
  label: string;
  /** Subject words; any of them may match. Quoted phrases stay quoted. */
  subjectAny: string[];
  attachment: boolean;
  /** Look-back window, e.g. "1y", "2y", "6m". */
  window: string;
}

export interface Source {
  id: string;
  name: string;
  aliases: string[];
  region: string;
  kinds: SourceKind[];
  senders: { domains: string[]; addresses: string[]; excludeDomains: string[] };
  searches: SourceSearch[];
  importer: { formats: string[]; adapters: string[]; supported: boolean; note?: string };
  /** Keys into passwordHintFormats. Formats only, never values. */
  passwordHints: string[];
  cadence: { every: "month" | "year"; expectedDay?: number; graceDays: number };
  download: string;
  verified: string | null;
  accountTypes?: string[];
  suggestsCas?: boolean;
  optional?: boolean;
}

export interface SourcesCatalog {
  version: number;
  updated: string;
  kinds: Record<SourceKind, string>;
  kindOrder: SourceKind[];
  passwordHintFormats: Record<string, string>;
  guides: Record<string, string>;
  sources: Source[];
}
