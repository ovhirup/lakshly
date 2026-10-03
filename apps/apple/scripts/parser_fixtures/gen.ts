// Generates the SYNTHETIC parser fixtures and golden outputs used by the Swift tests.
// Runs inside a temporary copy of packages/parsers (see ../generate_parser_fixtures.sh), so the
// fixtures and the expected outputs come straight from the web parsers. Never add real statements.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as F from "./tests/fixtures/synthetic.ts";
import { extract } from "./tests/helpers.ts";
import { emptyDataset, mergeResult, parseCsv, parseDocument, PasswordRequiredError } from "./src/index.ts";

const out = process.argv[2];
if (!out) throw new Error("usage: gen.ts <outDir>");
const exp = join(out, "expected");
mkdirSync(exp, { recursive: true });
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

const fixtures: { name: string; bytes: Promise<Uint8Array>; password?: string }[] = [
  { name: "hdfc-bank", bytes: F.hdfcBankPdf() },
  { name: "hdfc-bank-locked", bytes: F.hdfcBankPdf(F.PASSWORD), password: F.PASSWORD },
  { name: "sbi-bank", bytes: F.sbiBankPdf() },
  { name: "icici-bank", bytes: F.iciciBankPdf() },
  { name: "generic-bank", bytes: F.genericBankPdf() },
  { name: "hdfc-card", bytes: F.hdfcCardPdf() },
  { name: "sbi-card", bytes: F.sbiCardPdf() },
  { name: "generic-card", bytes: F.genericCardPdf() },
  { name: "cas", bytes: F.casPdf() },
  { name: "cas-locked", bytes: F.casPdf(F.PASSWORD), password: F.PASSWORD },
  { name: "nsdl-cas", bytes: F.nsdlCasPdf() },
  { name: "cdsl-cas", bytes: F.cdslCasPdf() },
  { name: "cdsl-cas-locked", bytes: F.cdslCasPdf(F.PASSWORD), password: F.PASSWORD },
];

const manifest: unknown[] = [];
const results: Record<string, ReturnType<typeof parseDocument>> = {};
for (const f of fixtures) {
  const bytes = await f.bytes;
  writeFileSync(join(out, `${f.name}.synthetic.pdf`), bytes);
  const doc = await extract(bytes.slice(), f.password);
  const result = parseDocument(doc);
  results[f.name] = result;
  writeFileSync(join(exp, `${f.name}.lines.json`), json(doc.lines.map((l) => ({ page: l.page, text: l.text }))));
  writeFileSync(join(exp, `${f.name}.result.json`), json(result));
  const entry: Record<string, unknown> = { name: f.name, file: `${f.name}.synthetic.pdf`, password: f.password ?? null };
  if (f.password) {
    const probe = async (pw?: string) => { try { await extract(bytes.slice(), pw); return "opened"; } catch (e) { return e instanceof PasswordRequiredError ? (e.incorrect ? "incorrect" : "required") : String(e); } };
    entry.withoutPassword = await probe(undefined);
    entry.wrongPassword = await probe("wrong");
  }
  manifest.push(entry);
}

// CSV case from the web test suite.
const csv = [
  "Date,Description,Debit,Credit,Balance",
  "01/09/2026,\"NEFT CR-DEMO EMPLOYER, SALARY\",,\"1,25,000.00\",\"1,85,000.00\"",
  "03/09/2026,UPI-SWIGGY-swiggy@demo-123456789012-Food,450.00,,\"1,84,550.00\"",
  "05/09/2026,POS DEMO BIGBASKET,\"2,345.50\",,\"1,82,204.50\"",
].join("\n");
writeFileSync(join(out, "generic.synthetic.csv"), csv + "\n");
writeFileSync(join(exp, "generic-csv.result.json"), json(parseCsv(csv, "demo.csv")));

// Merge / dedupe reports (dataset timestamps omitted; they depend on "now").
const first = mergeResult(emptyDataset(), results["hdfc-bank"]);
const again = mergeResult(first.dataset, results["sbi-bank"]);
const same = mergeResult(first.dataset, results["hdfc-bank-locked"]);
writeFileSync(join(exp, "merge.json"), json({
  first: first.report, firstTransactionIds: first.dataset.transactions.map((t) => t.id),
  againSbi: again.report,
  sameHdfcLocked: same.report, sameTransactionCount: same.dataset.transactions.length,
}));
writeFileSync(join(out, "manifest.json"), json({ password: F.PASSWORD, fixtures: manifest }));
console.log(`wrote ${fixtures.length} PDFs + CSV and golden outputs to ${out}`);
