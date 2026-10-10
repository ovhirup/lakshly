import type { ParseResult, TextDoc } from "./types.ts";
import { GENERIC_BANK_SPEC, genericBank } from "./adapters/generic.ts";
import { parseBank } from "./engines.ts";

/** RFC-4180-ish CSV splitter (quotes, escaped quotes, CRLF). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t" || c === ";") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Lay CSV cells out as a positioned TextDoc so the same table engine handles CSV and PDF. */
export function csvToTextDoc(text: string, fileName?: string): TextDoc {
  const rows = splitCsv(text);
  const width = Math.max(1, ...rows.map((r) => r.length));
  const colW = 120;
  return {
    pages: 1,
    fileName,
    lines: rows.map((r, i) => {
      const items = r.map((c, j) => ({ str: c.trim(), x: j * colW, w: colW - 10 })).filter((it) => it.str);
      // Right-align numbers within their cell, like a PDF table, so amount columns match by right edge.
      for (const it of items) if (/^-?[\d,]+\.\d{2}/.test(it.str)) it.x = Math.floor(it.x / colW) * colW;
      return { page: 1, y: -i, items, text: items.map((x) => x.str).join("   ") };
    }).filter((l) => l.items.length && width),
  };
}

/** Known bank CSV downloads, recognised by their header row (net-banking "download as CSV/Excel"). */
const CSV_BANKS: { id: string; institution: string; label: string; header: RegExp[] }[] = [
  { id: "csv.hdfc", institution: "HDFC Bank", label: "HDFC Bank CSV export", header: [/^narration$/i, /^chq\.?\s*\/\s*ref\.?\s*no\.?$/i, /^withdrawal amt\.?$/i, /^deposit amt\.?$/i] },
  { id: "csv.sbi", institution: "State Bank of India", label: "SBI CSV export", header: [/^txn date$/i, /^ref no\.?\s*\/\s*cheque no\.?$/i, /^debit$/i, /^credit$/i] },
  { id: "csv.icici", institution: "ICICI Bank", label: "ICICI Bank CSV export", header: [/^transaction remarks$/i, /^withdrawal amount\s*\(inr\s*\)$/i, /^deposit amount\s*\(inr\s*\)$/i] },
  { id: "csv.axis", institution: "Axis Bank", label: "Axis Bank CSV export", header: [/^tran date$/i, /^particulars$/i, /^dr$/i, /^cr$/i, /^init\.?\s*br$/i] },
];

export function detectCsvBank(text: string): (typeof CSV_BANKS)[number] | null {
  for (const row of splitCsv(text).slice(0, 25)) {
    const cells = row.map((c) => c.trim()).filter(Boolean);
    const hit = CSV_BANKS.find((b) => b.header.every((re) => cells.some((c) => re.test(c))));
    if (hit) return hit;
  }
  return null;
}

export function parseCsv(text: string, fileName?: string): ParseResult {
  const doc = csvToTextDoc(text, fileName);
  const bank = detectCsvBank(text);
  if (bank) {
    const body = parseBank(doc, { adapter: bank.id, institution: bank.institution, spec: GENERIC_BANK_SPEC, minHits: 3 });
    if (body.transactions.length) {
      const warnings = body.warnings.map((w) => w.startsWith("Account number not found") ? "This CSV has no account number; it is matched to your other statements from this bank." : w);
      return { adapter: bank.id, adapterLabel: bank.label, kind: "bank", confidence: 0.9, ...body, warnings };
    }
  }
  const body = genericBank.parse(doc);
  return { adapter: "csv.generic", adapterLabel: "CSV export (generic columns)", kind: "bank", confidence: body.transactions.length ? 0.6 : 0, ...body };
}
