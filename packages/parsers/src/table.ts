import type { Line, TextDoc, TextItem } from "./types.ts";
import { AMOUNT_RE, parseAmount } from "./util/money.ts";
import { parseDate } from "./util/dates.ts";

export type ColKey = "serial" | "date" | "valueDate" | "narration" | "ref" | "debit" | "credit" | "amount" | "balance";
export type HeaderSpec = Partial<Record<ColKey, RegExp>>;

export interface Column { key: ColKey; x0: number; x1: number }

const NUMERIC: ColKey[] = ["debit", "credit", "amount", "balance"];

/** Does this line look like the table header described by spec? Returns columns if ≥ minHits matched. */
export function matchHeader(line: Line, spec: HeaderSpec, minHits = 3): Column[] | null {
  const cols: Column[] = [];
  const used = new Set<TextItem>();
  for (const [key, re] of Object.entries(spec) as [ColKey, RegExp][]) {
    // A header cell may be split across several runs; try single runs first, then adjacent pairs.
    let hit: { x0: number; x1: number } | null = null;
    for (let i = 0; i < line.items.length && !hit; i++) {
      const a = line.items[i];
      if (used.has(a)) continue;
      if (re.test(a.str)) { hit = { x0: a.x, x1: a.x + a.w }; used.add(a); break; }
      const b = line.items[i + 1];
      if (b && !used.has(b) && re.test(`${a.str} ${b.str}`)) { hit = { x0: a.x, x1: b.x + b.w }; used.add(a); used.add(b); }
    }
    if (hit) cols.push({ key, ...hit });
  }
  return cols.length >= minHits ? cols.sort((a, b) => a.x0 - b.x0) : null;
}

const isAmountToken = (s: string) => AMOUNT_RE.test(s.trim());

/** Assign each item in a row to a column: amounts by right edge, text by left edge. */
export function assign(items: TextItem[], cols: Column[]): Partial<Record<ColKey, string>> {
  const out: Partial<Record<ColKey, string>> = {};
  const numeric = cols.filter((c) => NUMERIC.includes(c.key));
  const textCols = cols.filter((c) => !NUMERIC.includes(c.key));
  for (const it of items) {
    let col: Column | undefined;
    const right = it.x + it.w;
    if (isAmountToken(it.str) && numeric.length) {
      col = numeric.reduce((best, c) => (Math.abs(c.x1 - right) < Math.abs(best.x1 - right) ? c : best));
      // An amount far left of every numeric column belongs to a text column (e.g. a ref number).
      if (right < numeric[0].x0 - 40) col = undefined;
    }
    if (!col) {
      const cands = textCols.filter((c) => c.x0 <= it.x + 6);
      col = cands.length ? cands[cands.length - 1] : textCols[0] ?? cols[0];
    }
    out[col.key] = out[col.key] ? `${out[col.key]} ${it.str}` : it.str;
  }
  return out;
}

export interface Row {
  date: string;
  valueDate?: string;
  narration: string;
  ref?: string;
  debit?: number;
  credit?: number;
  amount?: number; // signed, from a single Dr/Cr amount column
  balance?: number;
  page: number;
}

const STOP_RE = /^(statement summary|opening balance|closing balance|\*+\s*end of statement|total|grand total|page \d+|this is a (computer|system) generated)/i;

/**
 * Walk the document, re-detecting the header on every page, and collect transaction rows.
 * Rows start where the date column holds a valid date; other lines are narration continuations.
 */
export function readTable(doc: TextDoc, spec: HeaderSpec, opts: { minHits?: number; dateKey?: ColKey } = {}): Row[] {
  const dateKey = opts.dateKey ?? "date";
  const rows: Row[] = [];
  let cols: Column[] | null = null;
  let open: Row | null = null;
  let page = 0;
  for (const line of doc.lines) {
    if (line.page !== page) { page = line.page; open = null; }
    const h = matchHeader(line, spec, opts.minHits ?? 3);
    if (h) { cols = h; open = null; continue; }
    if (!cols) continue;
    if (STOP_RE.test(line.text.trim())) { open = null; continue; }
    const cells = assign(line.items, cols);
    const date = cells[dateKey] ? parseDate(cells[dateKey]!.split(" ").slice(0, 3).join(" ")) ?? parseDate(cells[dateKey]!.split(" ")[0]) : null;
    if (date) {
      const num = (k: ColKey) => (cells[k] ? parseAmount(cells[k]!) ?? undefined : undefined);
      open = {
        date,
        valueDate: cells.valueDate ? parseDate(cells.valueDate) ?? undefined : undefined,
        narration: cells.narration ?? "",
        ref: cells.ref,
        debit: num("debit") !== undefined ? Math.abs(num("debit")!) : undefined,
        credit: num("credit") !== undefined ? Math.abs(num("credit")!) : undefined,
        amount: num("amount"),
        balance: num("balance"),
        page: line.page,
      };
      rows.push(open);
    } else if (open && cells.narration && !Object.keys(cells).some((k) => NUMERIC.includes(k as ColKey))) {
      open.narration = `${open.narration} ${cells.narration}`.trim();
    }
  }
  return rows;
}

/** Resolve each row to a signed amount (paise): credit +, debit −, else infer from balance movement. */
export function signedAmounts(rows: Row[], opening?: number): { row: Row; amount: number }[] {
  const out: { row: Row; amount: number }[] = [];
  let prevBal = opening;
  for (const row of rows) {
    let amount: number | undefined;
    if (row.credit && !row.debit) amount = row.credit;
    else if (row.debit && !row.credit) amount = -row.debit;
    else if (row.amount !== undefined) amount = row.amount;
    if (amount !== undefined && row.balance !== undefined && prevBal !== undefined && row.amount !== undefined && !row.credit && !row.debit) {
      // Unsigned single amount column: trust the balance movement for the sign.
      const delta = row.balance - prevBal;
      if (Math.abs(Math.abs(delta) - Math.abs(amount)) <= 1) amount = delta;
    }
    if (amount === undefined) { if (row.balance !== undefined) prevBal = row.balance; continue; }
    out.push({ row, amount });
    if (row.balance !== undefined) prevBal = row.balance;
  }
  return out;
}

/** Find a labelled value (date or amount) either on the same line after the label, or directly below it. */
export function valueNear(doc: TextDoc, label: RegExp, kind: "amount" | "date"): string | number | undefined {
  const parse = (s: string) => (kind === "amount" ? parseAmount(s) : parseDate(s.replace(/\s+/g, " ")));
  for (let i = 0; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    const idx = line.items.findIndex((it) => label.test(it.str));
    if (idx < 0) {
      const m = line.text.match(new RegExp(label.source + String.raw`\s*[:\-]?\s*(?:Rs\.?|₹|INR)?\s*([0-9][0-9,]*\.\d{2}(?:\s?(?:Cr|Dr|CR|DR))?|\d{1,2}[/.\- ](?:\d{1,2}|[A-Za-z]{3,4})[/.\- ]\d{2,4})`, "i"));
      if (m) { const v = parse(m[1]); if (v !== null) return v; }
      continue;
    }
    const lab = line.items[idx];
    // Same line: the next run(s) after the label.
    const after = line.items.slice(idx + 1).map((x) => x.str.replace(/^[:\-]\s*/, "")).filter(Boolean);
    const tail = lab.str.replace(label, "").replace(/^[\s:\-]+/, "");
    for (const cand of [tail, after[0], after.slice(0, 3).join(" "), after.slice(0, 2).join(" ")]) {
      if (!cand) continue;
      const v = parse(cand.replace(/^(Rs\.?|₹|INR)\s*/i, ""));
      if (v !== null) return v;
    }
    // Next line: the run horizontally closest to the label.
    const next = doc.lines[i + 1];
    if (next && next.page === line.page) {
      const cx = lab.x + lab.w / 2;
      const sorted = [...next.items].sort((a, b) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(b.x + b.w / 2 - cx));
      for (const it of sorted.slice(0, 2)) {
        const v = parse(it.str.replace(/^(Rs\.?|₹|INR)\s*/i, ""));
        if (v !== null) return v;
      }
    }
  }
  return undefined;
}

export function findText(doc: TextDoc, re: RegExp): RegExpMatchArray | null {
  for (const l of doc.lines) { const m = l.text.match(re); if (m) return m; }
  return null;
}

export function docText(doc: TextDoc, maxLines = 400): string {
  return doc.lines.slice(0, maxLines).map((l) => l.text).join("\n");
}
