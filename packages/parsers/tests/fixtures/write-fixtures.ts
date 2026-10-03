// Writes the SYNTHETIC fixture PDFs to tests/fixtures/out/ (gitignored) for manual testing.
import { mkdirSync, writeFileSync } from "node:fs";
import * as F from "./synthetic.ts";

const out = new URL("./out/", import.meta.url);
mkdirSync(out, { recursive: true });
const files: [string, Promise<Uint8Array>][] = [
  ["hdfc-bank.synthetic.pdf", F.hdfcBankPdf()],
  ["hdfc-bank-locked.synthetic.pdf", F.hdfcBankPdf(F.PASSWORD)],
  ["sbi-bank.synthetic.pdf", F.sbiBankPdf()],
  ["icici-bank.synthetic.pdf", F.iciciBankPdf()],
  ["generic-bank.synthetic.pdf", F.genericBankPdf()],
  ["hdfc-card.synthetic.pdf", F.hdfcCardPdf()],
  ["sbi-card.synthetic.pdf", F.sbiCardPdf()],
  ["generic-card.synthetic.pdf", F.genericCardPdf()],
  ["cas.synthetic.pdf", F.casPdf()],
  ["cas-locked.synthetic.pdf", F.casPdf(F.PASSWORD)],
  ["nsdl-cas.synthetic.pdf", F.nsdlCasPdf()],
  ["cdsl-cas.synthetic.pdf", F.cdslCasPdf()],
  ["cdsl-cas-locked.synthetic.pdf", F.cdslCasPdf(F.PASSWORD)],
];
for (const [name, p] of files) writeFileSync(new URL(name, out), await p);
console.log(`wrote ${files.length} synthetic fixtures (password for *-locked: ${F.PASSWORD})`);
