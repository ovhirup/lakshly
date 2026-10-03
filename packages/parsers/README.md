# @lakshly/parsers

On-device statement and CAS parsers for Lakshly. Pure TypeScript with **no runtime dependencies and no network access**. The caller injects pdf.js, so the same code runs in a browser Web Worker (`apps/web`) and in Node for tests.

```ts
import * as pdfjs from "pdfjs-dist";
import { extractPdfText, parseDocument, mergeResult, emptyDataset, PasswordRequiredError } from "@lakshly/parsers";

const doc = await extractPdfText(pdfjs, bytes, { password });   // throws PasswordRequiredError
const result = parseDocument(doc);                                // detect layout → schema-shaped output
const { dataset, report } = mergeResult(emptyDataset(), result);  // idempotent, dedupes on re-import
```

## What it produces
Output matches `packages/schema/lakshly.schema.json`:
- amounts are integers in paise;
- account, card and folio numbers are reduced to the **last 4 digits**, and long digit runs in narrations are redacted;
- ids are content-derived, so re-importing the same statement adds nothing.

Extra statement details that schema v0.1 has no field for are returned alongside the dataset as `meta` and `holdings`: total due, minimum due, due date, and units/NAV per scheme.

## Adapters
| id | Layout |
|---|---|
| `cas.cams-kfintech` | Detailed CAS from CAMS / KFintech: schemes, folios, units, NAV, cost and market value, transactions, SIP detection |
| `cas.depository` | NSDL / CDSL CAS: demat equities and MF units, MF folios, portfolio valuation and quantity movement counts |
| `bank.hdfc` | HDFC Bank account statement (Date · Narration · Chq./Ref.No. · Value Dt · Withdrawal · Deposit · Closing Balance) |
| `bank.sbi` | SBI account statement (Txn Date · Value Date · Description · Ref No./Cheque No. · Debit · Credit · Balance) |
| `bank.icici` | ICICI Bank detailed statement (S No. · Value Date · Transaction Date · … · Withdrawal · Deposit · Balance) |
| `card.hdfc` | HDFC Bank credit card (summary box; `Cr` suffix for credits) |
| `card.sbi` | SBI Card (`label : value` summary; `D`/`C` suffixes) |
| `bank.generic` | Fallback that finds the header by keywords and maps columns by position. If there is no debit/credit split, the sign comes from the balance movement |
| `card.generic` | Fallback for card statements: summary labels plus date-led rows |
| CSV (`parseCsv`) | Generic Date/Description/Debit/Credit/Balance exports |

Detection is scored from 0 to 1. A branded adapter must score at least 0.6, otherwise the matching generic fallback is used. To add a bank, implement `Adapter` (`detect` + `parse`, usually a `HeaderSpec` passed to `parseBank`, or labels passed to `parseCard`) and register it in `src/registry.ts`.

Depository CAS detection requires the consolidated statement title (or a `CAS` heading), an NSDL/CDSL issuer and a demat/BO/DP marker. Each demat account becomes a `stocks` account, including any MF units held in demat. MF folios follow the CAMS adapter's scheme-and-folio grouping as `mutual_fund` accounts, with `invested` when supplied. Account balances and `meta.totalValue` are in paise, dated at the period end. `meta.issuer` is `nsdl` or `cdsl`.

Depository `holdings` reuse the CAS fields: `scheme` is the security name, `nav` is its price/NAV in rupees, and `marketValue` is in paise. `folioMask` holds the account/folio's last four digits; registrar is `Unknown`. Unavailable cost is represented by `costValue: 0`, with no `invested` field on the account. Demat transaction debit/credit columns are **quantities, not money**: no cash transactions or SIPs are emitted; `meta.quantityTransactionCount` records the quantity-only rows. Password-protected depository PDFs use the existing `PasswordRequiredError` flow (normally a PAN password; synthetic fixtures use `DEMO1234` and contain no PAN).

## Tests
`npm test` builds **synthetic** PDFs in memory with `@cantoo/pdf-lib`, including password-protected ones, and runs them through pdf.js and every adapter. The tests also validate the output against the JSON Schema. `npm run fixtures` writes the same PDFs to `tests/fixtures/out/` (gitignored); their password is `DEMO1234`.

**Never add real statements to this repo.** Fixtures must be generated in code with fictional names and numbers.

License: MIT.
