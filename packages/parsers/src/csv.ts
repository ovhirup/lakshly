import type { ParseResult, TextDoc } from "./types.ts";
import { genericBank } from "./adapters/generic.ts";

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

export function parseCsv(text: string, fileName?: string): ParseResult {
  const doc = csvToTextDoc(text, fileName);
  const body = genericBank.parse(doc);
  return { adapter: "csv.generic", adapterLabel: "CSV export (generic columns)", kind: "bank", confidence: body.transactions.length ? 0.6 : 0, ...body };
}
