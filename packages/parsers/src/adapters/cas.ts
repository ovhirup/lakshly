import type { Account, Adapter, Holding, Sip, StatementMeta, TextDoc, Transaction } from "../types.ts";
import { docText } from "../table.ts";
import { parseDate } from "../util/dates.ts";
import { stableId } from "../util/hash.ts";
import { last4 } from "../util/mask.ts";
import { parseAmount, parseNumber } from "../util/money.ts";
import { normDesc } from "../engines.ts";

/**
 * CAMS / KFintech consolidated account statement (detailed CAS, as emailed by the RTAs).
 * Layout per scheme (both RTAs share it):
 *   <AMC name> Mutual Fund
 *   Folio No: 1234567890 / 12   PAN: OK  KYC: OK
 *   <code>-<Scheme name> - Direct Plan - Growth (Advisor: DIRECT)  ISIN: INF...  Registrar : CAMS
 *   Opening Unit Balance: 0.000
 *   dd-Mon-yyyy  <description>  amount  units  price  unit-balance
 *   Closing Unit Balance: 1,234.567  NAV on dd-Mon-yyyy: INR 112.34  Total Cost Value: 1,30,000.00  Market Value on dd-Mon-yyyy: INR 1,38,690.12
 * Ported in spirit from the MIT-licensed casparser project (re-implemented, no code copied).
 */
const NUM = String.raw`\(?-?[\d,]+\.\d+\)?`;
const TXN_RE = new RegExp(String.raw`^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+(${NUM})\s+(${NUM})\s+(${NUM})\s+(${NUM})$`);
const TAX_RE = /^(\d{2}-[A-Za-z]{3}-\d{4})\s+\*{2,}.*\*{2,}/;
const FOLIO_RE = /Folio\s*No\s*:\s*([0-9A-Za-z/ ]+?)(?:\s{2,}|\s+PAN|\s+KYC|$)/i;
const SCHEME_RE = /^(?:[A-Z0-9]{2,8}-)?(.+?)(?:\s*\(\s*(?:Advisor|formerly)[^)]*\))?\s*(?:-?\s*ISIN\s*:\s*([A-Z0-9]{12}))?\s*(?:\(?\s*Registrar\s*:\s*(CAMS|KFINTECH|KARVY)\s*\)?)?$/i;
const CLOSE_RE = /Closing Unit Balance\s*:?\s*([\d,]+\.\d+)/i;
const NAV_RE = /NAV on\s*(\d{2}-[A-Za-z]{3}-\d{4})\s*:?\s*INR\s*([\d,]+\.\d+)/i;
const COST_RE = /(?:Total )?Cost Value\s*:?\s*(?:INR\s*)?([\d,]+\.\d{2})/i;
const MV_RE = /Market Value on\s*\d{2}-[A-Za-z]{3}-\d{4}\s*:?\s*INR\s*([\d,]+\.\d{2})/i;

interface SchemeAcc {
  amc: string; folio: string; scheme: string; isin?: string; registrar: Holding["registrar"];
  txns: { date: string; desc: string; amount: number; units: number; nav: number }[];
  units?: number; nav?: number; navDate?: string; cost?: number; mv?: number;
}

const signedNum = (s: string) => {
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const n = parseNumber(s.replace(/[()]/g, "").replace(/^-/, "")) ?? 0;
  return neg ? -n : n;
};

export function parseCasText(doc: TextDoc) {
  const lines = doc.lines.map((l) => l.text.replace(/\s+/g, " ").trim());
  const schemes: SchemeAcc[] = [];
  let amc = "";
  let folio = "";
  let cur: SchemeAcc | null = null;
  let periodTo: string | undefined;
  let periodFrom: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    const pm = t.match(/(\d{2}-[A-Za-z]{3}-\d{4})\s+To\s+(\d{2}-[A-Za-z]{3}-\d{4})/i);
    if (pm && !periodTo) { periodFrom = parseDate(pm[1]) ?? undefined; periodTo = parseDate(pm[2]) ?? undefined; continue; }
    if (/^[A-Za-z0-9&.' ]+ Mutual Fund$/i.test(t)) { amc = t; continue; }
    const fm = t.match(FOLIO_RE);
    if (fm) { folio = fm[1].trim(); cur = null; continue; }
    if (folio && !cur && /Registrar\s*:/i.test(t)) {
      const sm = t.match(SCHEME_RE);
      const reg = (sm?.[3] ?? "").toUpperCase();
      cur = {
        amc: amc.replace(/ Mutual Fund$/i, "").trim() || "Mutual Fund",
        folio,
        scheme: (sm?.[1] ?? t).replace(/\s*-\s*$/, "").trim().slice(0, 120),
        isin: sm?.[2],
        registrar: reg === "CAMS" ? "CAMS" : reg ? "KFintech" : "Unknown",
        txns: [],
      };
      schemes.push(cur);
      continue;
    }
    if (!cur) continue;
    if (TAX_RE.test(t)) continue; // stamp duty / STT lines
    const tm = t.match(TXN_RE);
    if (tm) {
      const date = parseDate(tm[1]);
      const amount = parseAmount(tm[3].replace(/[()]/g, "")) ?? 0;
      const units = signedNum(tm[4]);
      if (date) cur.txns.push({ date, desc: tm[2], amount: units < 0 || tm[3].startsWith("(") ? -Math.abs(amount) : Math.abs(amount), units, nav: signedNum(tm[5]) });
      continue;
    }
    const cm = t.match(CLOSE_RE);
    if (cm) {
      // Valuation fields may sit on this line or the next one.
      const block = `${t} ${lines[i + 1] ?? ""}`;
      cur.units = parseNumber(cm[1]) ?? 0;
      const nm = block.match(NAV_RE);
      if (nm) { cur.navDate = parseDate(nm[1]) ?? undefined; cur.nav = parseNumber(nm[2]) ?? undefined; }
      const cv = block.match(COST_RE); if (cv) cur.cost = parseAmount(cv[1]) ?? undefined;
      const mv = block.match(MV_RE); if (mv) cur.mv = parseAmount(mv[1]) ?? undefined;
      cur = null;
    }
  }
  return { schemes, periodFrom, periodTo };
}

export const cas: Adapter = {
  id: "cas.cams-kfintech",
  label: "Mutual fund CAS (CAMS / KFintech)",
  kind: "cas",
  institution: "CAMS / KFintech",
  detect: (doc) => {
    const t = docText(doc);
    if (!/Consolidated Account Statement/i.test(t)) return 0;
    const hits = [/Folio No/i, /Registrar\s*:\s*(CAMS|KFINTECH|KARVY)/i, /Closing Unit Balance/i, /NAV on/i, /Market Value/i].filter((r) => r.test(t)).length;
    return 0.5 + 0.1 * hits;
  },
  parse: (doc) => {
    const { schemes, periodFrom, periodTo } = parseCasText(doc);
    const accounts: Account[] = [];
    const transactions: Transaction[] = [];
    const sips: Sip[] = [];
    const holdings: Holding[] = [];
    const warnings: string[] = [];
    if (!schemes.length) warnings.push("No schemes found. Please use the *detailed* CAS (not the summary).");
    for (const s of schemes) {
      const folioMask = last4(s.folio.split("/")[0]) ?? last4(s.folio) ?? "XXXX";
      const accountId = stableId("acc", "cas", s.folio.replace(/\D/g, ""), s.isin ?? s.scheme);
      const asOf = s.navDate ?? periodTo ?? s.txns.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
      const mv = s.mv ?? Math.round((s.units ?? 0) * (s.nav ?? 0) * 100);
      const cost = s.cost ?? s.txns.reduce((x, t) => x + t.amount, 0);
      accounts.push({
        id: accountId, name: s.scheme.slice(0, 80), type: "mutual_fund", institution: `${s.amc} Mutual Fund`.slice(0, 80),
        mask: folioMask, currency: "INR", balance: mv, invested: cost, asOf, source: "cas",
      });
      holdings.push({ accountId, scheme: s.scheme, amc: s.amc, registrar: s.registrar, folioMask, isin: s.isin, units: s.units ?? 0, nav: s.nav ?? 0, navDate: asOf, costValue: cost, marketValue: mv });
      const seen = new Map<string, number>();
      for (const t of s.txns) {
        const description = t.desc.slice(0, 140);
        const key = `${t.date}|${t.amount}|${normDesc(description)}`;
        const n = (seen.get(key) ?? 0) + 1; seen.set(key, n);
        const isSip = /systematic|\bSIP\b/i.test(t.desc);
        transactions.push({
          id: stableId("txn", accountId, key, n), accountId, date: t.date,
          // Seen from the fund account: purchases add value (+), redemptions remove it (−).
          amount: t.amount, description, merchant: s.amc.slice(0, 80), category: "investments",
          method: isSip ? "autodebit" : "other", recurring: isSip, categorisedBy: "rule",
          tags: [`units:${t.units}`.slice(0, 32), `nav:${t.nav}`.slice(0, 32)],
        });
      }
      const sipTx = s.txns.filter((t) => /systematic|\bSIP\b/i.test(t.desc) && t.amount > 0);
      if (sipTx.length) {
        const days = sipTx.map((t) => Number(t.date.slice(8, 10)));
        const mode = [...new Set(days)].sort((a, b) => days.filter((d) => d === b).length - days.filter((d) => d === a).length)[0];
        const last = sipTx.at(-1)!;
        const end = periodTo ?? last.date;
        const gapDays = (Date.parse(end) - Date.parse(last.date)) / 86400000;
        sips.push({
          id: stableId("sip", accountId), scheme: s.scheme.slice(0, 120), platform: s.registrar === "Unknown" ? undefined : s.registrar,
          amount: last.amount, dayOfMonth: Math.min(28, Math.max(1, mode)), startDate: sipTx[0].date,
          status: gapDays <= 40 ? "active" : "paused", accountId,
        });
        if (sips.at(-1)!.platform === undefined) delete sips.at(-1)!.platform;
      }
    }
    const meta: StatementMeta[] = [{ adapter: "cas.cams-kfintech", kind: "cas", institution: "CAMS / KFintech", accountId: accounts[0]?.id ?? "acc_none000", periodFrom, periodTo }];
    return { accounts, transactions, sips, holdings, meta, warnings };
  },
};
