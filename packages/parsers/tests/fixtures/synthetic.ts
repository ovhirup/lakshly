/**
 * SYNTHETIC statement fixtures. Every name, number, merchant and amount here is fictional and
 * generated in code; layouts mimic publicly documented statement formats. Never add real statements.
 */
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";

export const PASSWORD = "DEMO1234";

/** Indian digit grouping for paise amounts, e.g. 12345600 → "1,23,456.00". */
export function inr(paise: number): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100).toString();
  const frac = String(abs % 100).padStart(2, "0");
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}${rest ? `${rest},${last3}` : last3}.${frac}`;
}

interface Pen { text(s: string, x: number, y: number, o?: { size?: number; bold?: boolean; right?: boolean }): void }
type Draw = (pen: Pen) => void;

async function makePdf(pages: Draw[], password?: string, size: [number, number] = [842, 595]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("Synthetic demo statement");
  doc.setProducer("Lakshly synthetic fixtures");
  doc.setCreator("Lakshly");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const draw of pages) {
    const page: PDFPage = doc.addPage(size); // A4 landscape by default
    const H = page.getHeight();
    draw({
      text(s, x, y, o = {}) {
        const f: PDFFont = o.bold ? bold : font;
        const size = o.size ?? 8;
        const w = f.widthOfTextAtSize(s, size);
        page.drawText(s, { x: o.right ? x - w : x, y: H - y, size, font: f });
      },
    });
  }
  if (password) doc.encrypt({ userPassword: password, ownerPassword: `${password}-owner` });
  return doc.save({ useObjectStreams: false });
}

interface Col { title: string; x: number; right?: boolean }
function table(pen: Pen, cols: Col[], rows: string[][], y0: number, step = 14): number {
  cols.forEach((c) => pen.text(c.title, c.x, y0, { bold: true, right: c.right }));
  let y = y0 + step;
  for (const r of rows) {
    r.forEach((cell, i) => { if (cell) for (const [k, part] of cell.split("\n").entries()) pen.text(part, cols[i].x, y + k * 10, { right: cols[i].right }); });
    y += step + (Math.max(...r.map((c) => c.split("\n").length)) - 1) * 10;
  }
  return y;
}

// ---------- Bank: shared synthetic month ----------
export interface BankTxn { d: number; narr: string; amt: number } // amt in paise, + credit / − debit
export const BANK_OPENING = 6000000; // ₹60,000.00
export const BANK_TXNS: BankTxn[] = [
  { d: 1, narr: "NEFT CR-DEMO EMPLOYER PVT LTD-SALARY SEP 2026", amt: 12500000 },
  { d: 2, narr: "ACH D- DEMO HOUSING RENT-0000123", amt: -2500000 },
  { d: 3, narr: "UPI-SWIGGY-swiggy@demo-123456789012-Food order", amt: -45000 },
  { d: 5, narr: "POS 416021XXXXXX1234 BIGBASKET DEMO", amt: -234550 },
  { d: 7, narr: "UPI-ZEPTO-zepto@demo-223456789012\nDEMO GROCERIES ORDER", amt: -67800 },
  { d: 10, narr: "ATM WDL-DEMO ATM BLR", amt: -500000 },
  { d: 12, narr: "IMPS-CASHBACK-DEMO WALLET", amt: 15000 },
  { d: 15, narr: "CC 000XXXXXXXX1234 AUTOPAY SI-TAD CREDIT CARD", amt: -1824000 },
  { d: 20, narr: "NACH-DEMO AMC SIP MUTUAL FUND", amt: -500000 },
  { d: 25, narr: "UPI-UBER INDIA-uber@demo-323456789012-Ride", amt: -31200 },
  { d: 28, narr: "INT.PD:DEMO SAVINGS INTEREST", amt: 41200 },
  { d: 30, narr: "UPI-NETFLIX-netflix@demo-423456789012-Subscription", amt: -64900 },
];
export const BANK_CLOSING = BANK_OPENING + BANK_TXNS.reduce((s, t) => s + t.amt, 0);

function withBalances() {
  let bal = BANK_OPENING;
  return BANK_TXNS.map((t) => ({ ...t, bal: (bal += t.amt) }));
}
const dd = (d: number) => String(d).padStart(2, "0");

/** HDFC-style layout: Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance. */
export function hdfcBankPdf(password?: string) {
  const rows = withBalances();
  const cols: Col[] = [
    { title: "Date", x: 30 }, { title: "Narration", x: 85 }, { title: "Chq./Ref.No.", x: 380 }, { title: "Value Dt", x: 480 },
    { title: "Withdrawal Amt.", x: 620, right: true }, { title: "Deposit Amt.", x: 710, right: true }, { title: "Closing Balance", x: 810, right: true },
  ];
  const fmt = (r: (typeof rows)[number], i: number) => [`${dd(r.d)}/09/26`, r.narr, `000000${4000 + i}`, `${dd(r.d)}/09/26`, r.amt < 0 ? inr(-r.amt) : "", r.amt > 0 ? inr(r.amt) : "", inr(r.bal)];
  const head = (p: Pen) => {
    p.text("HDFC BANK", 30, 30, { bold: true, size: 14 });
    p.text("Statement of account (SYNTHETIC DEMO)", 30, 48);
    p.text("DEMO CUSTOMER A", 30, 62);
    p.text("Account No :", 500, 62); p.text("50100000004321", 560, 62);
    p.text("Statement From : 01/09/2026 To : 30/09/2026", 500, 76);
  };
  return makePdf([
    (p) => { head(p); table(p, cols, rows.slice(0, 9).map(fmt), 110); p.text("Page 1 of 2", 30, 560); },
    (p) => {
      head(p);
      const y = table(p, cols, rows.slice(9).map((r, i) => fmt(r, i + 9)), 110);
      p.text("STATEMENT SUMMARY :-", 30, y + 20, { bold: true });
      const sx = [30, 150, 250, 350, 470, 600];
      ["Opening Balance", "Dr Count", "Cr Count", "Debits", "Credits", "Closing Bal"].forEach((s, i) => p.text(s, sx[i], y + 36));
      const debits = BANK_TXNS.filter((t) => t.amt < 0);
      const credits = BANK_TXNS.filter((t) => t.amt > 0);
      [inr(BANK_OPENING), String(debits.length), String(credits.length), inr(-debits.reduce((s, t) => s + t.amt, 0)), inr(credits.reduce((s, t) => s + t.amt, 0)), inr(BANK_CLOSING)]
        .forEach((s, i) => p.text(s, sx[i], y + 50));
      p.text("Page 2 of 2", 30, 560);
    },
  ], password);
}

/** SBI-style layout: Txn Date | Value Date | Description | Ref No./Cheque No. | Debit | Credit | Balance. */
export function sbiBankPdf() {
  const rows = withBalances();
  const cols: Col[] = [
    { title: "Txn Date", x: 30 }, { title: "Value Date", x: 100 }, { title: "Description", x: 170 }, { title: "Ref No./Cheque No.", x: 450 },
    { title: "Debit", x: 640, right: true }, { title: "Credit", x: 720, right: true }, { title: "Balance", x: 810, right: true },
  ];
  return makePdf([(p) => {
    p.text("State Bank of India", 30, 30, { bold: true, size: 14 });
    p.text("Account Name : DEMO CUSTOMER B", 30, 50);
    p.text("Account Number : 00000039876543", 30, 64);
    p.text("Account Statement from 1 Sep 2026 to 30 Sep 2026", 30, 78);
    p.text("Opening Balance", 500, 64); p.text(": " + inr(BANK_OPENING), 590, 64);
    table(p, cols, rows.map((r, i) => [`${r.d} Sep 2026`, `${r.d} Sep 2026`, r.narr, `TRF${700000 + i}`, r.amt < 0 ? inr(-r.amt) : "", r.amt > 0 ? inr(r.amt) : "", inr(r.bal)]), 110);
  }]);
}

/** ICICI-style layout: S No. | Value Date | Transaction Date | Cheque Number | Transaction Remarks | Withdrawal | Deposit | Balance. */
export function iciciBankPdf() {
  const rows = withBalances();
  const cols: Col[] = [
    { title: "S No.", x: 25 }, { title: "Value Date", x: 60 }, { title: "Transaction Date", x: 130 }, { title: "Cheque Number", x: 215 },
    { title: "Transaction Remarks", x: 290 }, { title: "Withdrawal Amount (INR )", x: 620, right: true }, { title: "Deposit Amount (INR )", x: 735, right: true }, { title: "Balance (INR )", x: 820, right: true },
  ];
  return makePdf([(p) => {
    p.text("ICICI Bank", 30, 30, { bold: true, size: 14 });
    p.text("Detailed Statement (SYNTHETIC DEMO)", 30, 48);
    p.text("Account Number : XXXXXXXX5678 - DEMO CUSTOMER C", 30, 62);
    p.text("Transaction Period : From 01/09/2026 To 30/09/2026", 30, 76);
    table(p, cols, rows.map((r, i) => [String(i + 1), `${dd(r.d)}/09/2026`, `${dd(r.d)}/09/2026`, "", r.narr, r.amt < 0 ? inr(-r.amt) : "", r.amt > 0 ? inr(r.amt) : "", inr(r.bal)]), 110);
  }]);
}

/** Unknown bank, single unsigned Amount column: signs must come from the balance movement. */
export function genericBankPdf() {
  const rows = withBalances();
  const cols: Col[] = [{ title: "Tran Date", x: 30 }, { title: "Particulars", x: 110 }, { title: "Amount", x: 640, right: true }, { title: "Balance", x: 760, right: true }];
  return makePdf([(p) => {
    p.text("Demo Cooperative Bank", 30, 30, { bold: true, size: 14 });
    p.text("Acct No: 0000111122223333", 30, 50);
    p.text("Opening Balance: " + inr(BANK_OPENING), 30, 64);
    table(p, cols, rows.map((r) => [`${dd(r.d)}-09-2026`, r.narr.replace("\n", " "), inr(Math.abs(r.amt)), inr(r.bal)]), 100);
  }]);
}

// ---------- Cards ----------
export interface CardTxn { date: string; desc: string; amt: number; credit?: boolean }
export const HDFC_CARD_TXNS: CardTxn[] = [
  { date: "28/08/2026", desc: "SWIGGY BANGALORE", amt: 45600 },
  { date: "02/09/2026", desc: "PAYMENT RECEIVED - THANK YOU", amt: 1824000, credit: true },
  { date: "04/09/2026", desc: "AMAZON PAY INDIA DEMO", amt: 349900 },
  { date: "09/09/2026", desc: "DEMO FUEL STATION HPCL", amt: 210000 },
  { date: "14/09/2026", desc: "BOOKMYSHOW DEMO", amt: 76000 },
  { date: "18/09/2026", desc: "REFUND AMAZON PAY INDIA DEMO", amt: 49900, credit: true },
  { date: "21/09/2026", desc: "DEMO PHARMACY APOLLO", amt: 128000 },
];
export const HDFC_CARD = { totalDue: 2431000, minDue: 122000, dueDate: "2026-10-15", statementDate: "2026-09-25", limit: 20000000 };

export function hdfcCardPdf() {
  return makePdf([(p) => {
    p.text("HDFC BANK", 30, 30, { bold: true, size: 14 });
    p.text("Credit Card Statement (SYNTHETIC DEMO)", 30, 48);
    p.text("DEMO CUSTOMER A", 30, 62);
    p.text("Card No:", 500, 48); p.text("XXXX XXXX XXXX 4417", 545, 48);
    p.text("Statement Date", 500, 62); p.text(": 25/09/2026", 580, 62);
    p.text("Credit Limit", 500, 76); p.text(": 2,00,000", 580, 76);
    ["Payment Due Date", "Total Dues", "Minimum Amount Due"].forEach((s, i) => p.text(s, 30 + i * 160, 100, { bold: true }));
    ["15/10/2026", inr(HDFC_CARD.totalDue), inr(HDFC_CARD.minDue)].forEach((s, i) => p.text(s, 30 + i * 160, 114));
    p.text("Domestic Transactions", 30, 150, { bold: true });
    p.text("Date", 30, 166, { bold: true }); p.text("Transaction Description", 110, 166, { bold: true }); p.text("Amount (in Rs.)", 700, 166, { bold: true, right: true });
    HDFC_CARD_TXNS.forEach((t, i) => {
      const y = 182 + i * 14;
      p.text(t.date, 30, y); p.text(t.desc, 110, y); p.text(inr(t.amt) + (t.credit ? " Cr" : ""), 700, y, { right: true });
    });
    p.text("Reward Points Summary", 30, 320, { bold: true });
    p.text("Opening 1,200   Earned 340   Closing 1,540", 30, 334);
  }]);
}

export const SBI_CARD_TXNS: CardTxn[] = [
  { date: "21 Aug 26", desc: "DEMO ELECTRICITY BILLDESK", amt: 123400 },
  { date: "25 Aug 26", desc: "PAYMENT RECEIVED BBPS", amt: 1000000, credit: true },
  { date: "29 Aug 26", desc: "ZOMATO DEMO", amt: 38000 },
  { date: "03 Sep 26", desc: "IRCTC DEMO TICKET", amt: 215500 },
  { date: "10 Sep 26", desc: "DEMO GROCER BLINKIT", amt: 89900 },
  { date: "12 Sep 26", desc: "LATE PAYMENT FEE", amt: 50000 },
];
export const SBI_CARD = { totalDue: 1234567, minDue: 62000, dueDate: "2026-10-10", statementDate: "2026-09-20" };

export function sbiCardPdf() {
  return makePdf([(p) => {
    p.text("SBI Card", 30, 30, { bold: true, size: 14 });
    p.text("SBI Cards and Payment Services Ltd (SYNTHETIC DEMO)", 30, 46);
    p.text("Credit Card Number : XXXX XXXX XXXX 9012", 30, 62);
    p.text("Statement Date : 20 Sep 2026", 30, 76);
    p.text("Total Amount Due : Rs. " + inr(SBI_CARD.totalDue), 450, 62);
    p.text("Minimum Amount Due : Rs. " + inr(SBI_CARD.minDue), 450, 76);
    p.text("Payment Due Date : 10 Oct 2026", 450, 90);
    p.text("Transactions for DEMO CUSTOMER B", 30, 120, { bold: true });
    p.text("Date", 30, 136, { bold: true }); p.text("Transaction Details", 110, 136, { bold: true }); p.text("Amount", 700, 136, { bold: true, right: true });
    SBI_CARD_TXNS.forEach((t, i) => {
      const y = 152 + i * 14;
      p.text(t.date, 30, y); p.text(t.desc, 110, y); p.text(`${inr(t.amt)} ${t.credit ? "C" : "D"}`, 700, y, { right: true });
    });
    p.text("Reward Summary", 30, 260, { bold: true });
  }]);
}

export function genericCardPdf() {
  return makePdf([(p) => {
    p.text("Demo Finance Card", 30, 30, { bold: true, size: 14 });
    p.text("Card Number: XXXX-XXXX-XXXX-3456", 30, 48);
    p.text("Statement Date: 05-09-2026", 30, 62);
    p.text("Total Outstanding: Rs 5,432.10", 400, 48);
    p.text("Min. Due: Rs 300.00", 400, 62);
    p.text("Due Date: 25-09-2026", 400, 76);
    const rows: [string, string, string][] = [["12-08-2026", "DEMO CAFE", "250.00"], ["15-08-2026", "REFUND DEMO STORE", "499.00 CR"], ["20-08-2026", "DEMO BOOKS ONLINE", "5,681.10"]];
    rows.forEach(([d, s, a], i) => { p.text(d, 30, 110 + i * 14); p.text(s, 110, 110 + i * 14); p.text(a, 600, 110 + i * 14, { right: true }); });
  }]);
}

// ---------- CAS ----------
export interface CasScheme { amc: string; folio: string; code: string; scheme: string; isin: string; registrar: "CAMS" | "KFINTECH"; openingUnits: number; txns: { date: string; desc: string; amt: number; nav: number }[]; nav: number; cost: number }
export const CAS_SCHEMES: CasScheme[] = [
  {
    amc: "Example Demo Mutual Fund", folio: "91234567 / 12", code: "D123", scheme: "Example Demo Flexi Cap Fund - Direct Plan - Growth", isin: "INF0DEMO0001", registrar: "CAMS",
    openingUnits: 100, nav: 121.34, cost: 4100000,
    txns: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m, i) => ({ date: `05-${m}-2026`, desc: `Systematic Investment Purchase - Instalment ${13 + i}`, amt: 500000, nav: 110.81 + i * 2 })),
  },
  {
    amc: "Example Demo Mutual Fund", folio: "91234567 / 12", code: "D456", scheme: "Example Demo Nifty Index Fund - Direct Plan - Growth", isin: "INF0DEMO0002", registrar: "CAMS",
    openingUnits: 0, nav: 25.5, cost: 1800000,
    txns: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m, i) => ({ date: `10-${m}-2026`, desc: "SIP Purchase - via Demo Invest App", amt: 300000, nav: 23.9 + i * 0.3 })),
  },
  {
    amc: "Sample Demo Mutual Fund", folio: "55500011 / 0", code: "S789", scheme: "Sample Demo Short Duration Fund - Direct Plan - Growth", isin: "INF0DEMO0003", registrar: "KFINTECH",
    openingUnits: 0, nav: 126.2, cost: 1500000,
    txns: [
      { date: "15-Apr-2026", desc: "Purchase", amt: 2500000, nav: 120 },
      { date: "18-Aug-2026", desc: "Redemption", amt: -1000000, nav: 125 },
    ],
  },
];

const units = (amt: number, nav: number) => Math.round((amt / 100 / nav) * 1000) / 1000;
export function casClosingUnits(s: CasScheme): number {
  return Math.round((s.openingUnits + s.txns.reduce((u, t) => u + units(t.amt, t.nav), 0)) * 1000) / 1000;
}
export const casMarketValue = (s: CasScheme) => Math.round(casClosingUnits(s) * s.nav * 100);

export function casPdf(password?: string) {
  const fmtNum = (n: number, dp: number) => (n < 0 ? `(${Math.abs(n).toFixed(dp)})` : n.toFixed(dp));
  const fmtAmt = (p: number) => (p < 0 ? `(${inr(-p)})` : inr(p));
  return makePdf([(p) => {
    let y = 30;
    const L = (s: string, x = 30, o?: { bold?: boolean; size?: number }) => { p.text(s, x, y, o); };
    L("Consolidated Account Statement", 30, { bold: true, size: 13 }); y += 16;
    L("01-Apr-2026 To 30-Sep-2026"); y += 14;
    L("DEMO INVESTOR (SYNTHETIC)"); y += 20;
    let lastAmc = "";
    for (const s of CAS_SCHEMES) {
      if (s.amc !== lastAmc) { L(s.amc, 30, { bold: true }); y += 14; lastAmc = s.amc; }
      L(`Folio No: ${s.folio}`); p.text("PAN: OK", 260, y); p.text("KYC: OK", 330, y); y += 12;
      L(`${s.code}-${s.scheme} (Advisor: DIRECT)`); p.text(`ISIN: ${s.isin}`, 470, y); p.text(`Registrar : ${s.registrar}`, 600, y); y += 12;
      L(`Opening Unit Balance: ${s.openingUnits.toFixed(3)}`); y += 12;
      let bal = s.openingUnits;
      for (const t of s.txns) {
        const u = units(t.amt, t.nav);
        bal = Math.round((bal + u) * 1000) / 1000;
        p.text(t.date, 30, y); p.text(t.desc, 100, y);
        p.text(fmtAmt(t.amt), 520, y, { right: true }); p.text(fmtNum(u, 3), 600, y, { right: true });
        p.text(t.nav.toFixed(4), 680, y, { right: true }); p.text(bal.toFixed(3), 770, y, { right: true });
        y += 11;
        if (t.amt > 0) { p.text(t.date, 30, y); p.text("*** Stamp Duty ***", 100, y); p.text("0.25", 520, y, { right: true }); y += 11; }
      }
      L(`Closing Unit Balance: ${casClosingUnits(s).toFixed(3)}`); p.text(`NAV on 30-Sep-2026: INR ${s.nav.toFixed(4)}`, 220, y);
      p.text(`Total Cost Value: ${inr(s.cost)}`, 420, y); p.text(`Market Value on 30-Sep-2026: INR ${inr(casMarketValue(s))}`, 580, y); y += 22;
    }
  }], password, [842, 1100]);
}
