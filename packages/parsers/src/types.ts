import type { Account, Category, LakshlyDataset, Sip, Transaction } from "./schema.gen.ts";

export type { Account, Category, LakshlyDataset, Sip, Transaction };

/** One positioned text run from a PDF page (or a CSV cell). */
export interface TextItem { str: string; x: number; w: number }

/** A visual line of text: items sharing a baseline, sorted left → right. */
export interface Line { page: number; y: number; items: TextItem[]; text: string }

/** Text extracted from a document. Never contains the password or raw bytes. */
export interface TextDoc { pages: number; lines: Line[]; fileName?: string }

export type StatementKind = "bank" | "card" | "cas";

/** Fund-level detail from a CAS that the v0.1 dataset schema has no field for. */
export interface Holding {
  accountId: string;
  scheme: string;
  amc: string;
  registrar: "CAMS" | "KFintech" | "Unknown";
  folioMask: string;
  isin?: string;
  units: number;
  nav: number;
  navDate: string;
  costValue: number;  // paise
  marketValue: number; // paise
}

export interface StatementMeta {
  adapter: string;
  kind: StatementKind;
  institution: string;
  accountId: string;
  periodFrom?: string;
  periodTo?: string;
  statementDate?: string;
  dueDate?: string;
  totalDue?: number; // paise
  minDue?: number;   // paise
  openingBalance?: number;
  closingBalance?: number;
}

export interface ParseResult {
  adapter: string;
  adapterLabel: string;
  kind: StatementKind;
  confidence: number; // 0..1 detection score
  accounts: Account[];
  transactions: Transaction[];
  sips: Sip[];
  holdings: Holding[];
  meta: StatementMeta[];
  warnings: string[];
}

export interface Adapter {
  id: string;
  label: string;
  kind: StatementKind;
  institution: string;
  /** 0 = definitely not this layout, 1 = certain. */
  detect(doc: TextDoc): number;
  parse(doc: TextDoc): Omit<ParseResult, "adapter" | "adapterLabel" | "kind" | "confidence">;
}
